import { parse } from 'csv-parse';
import { stringify } from 'csv-stringify/sync';
import axios from 'axios';
import { NextResponse } from 'next/server';

// 任务队列管理器
class TaskQueue {
  constructor(concurrencyLimit) {
    this.queue = [];
    this.running = new Set();
    this.concurrencyLimit = concurrencyLimit;
    this.results = [];
  }

  async add(task) {
    return new Promise((resolve) => {
      this.queue.push({
        task,
        resolve
      });
      this.processNext();
    });
  }

  async processNext() {
    if (this.running.size >= this.concurrencyLimit || this.queue.length === 0) return;

    const { task, resolve } = this.queue.shift();
    this.running.add(task);

    try {
      const result = await task();
      this.results.push(result);
      resolve(result);
    } catch (error) {
      this.results.push({ error: error.message });
      resolve({ error: error.message });
    } finally {
      this.running.delete(task);
      this.processNext();
    }
  }

  getResults() {
    return this.results;
  }
}

export async function POST(req) {
  const { fileContent, mapping, apiUrl, apiKey, concurrencyLimit } = await req.json();
  
  if (!fileContent || !mapping || !apiUrl || !apiKey) {
    return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
  }

  try {
    const records = await parseCSV(fileContent);
    console.log('CSV parsing completed. Total records:', records.length);

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const taskQueue = new TaskQueue(concurrencyLimit);
          const totalRecords = records.length;

          // 发送初始进度
          controller.enqueue(encoder.encode(`progress:0/${totalRecords}\n`));

          // 创建所有任务
          const tasks = records.map((record, index) => async () => {
            const result = await processRecord(record, mapping, apiUrl, apiKey);
            // 发送进度更新
            controller.enqueue(encoder.encode(`progress:${index + 1}/${totalRecords}\n`));
            return result;
          });

          // 添加所有任务到队列
          await Promise.all(tasks.map(task => taskQueue.add(task)));

          // 获取所有结果并发送
          const processedRecords = taskQueue.getResults();
          const output = stringify(processedRecords, { header: true });
          controller.enqueue(encoder.encode(output));
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="processed_${Date.now()}.csv"`,
        'Transfer-Encoding': 'chunked'
      },
    });
  } catch (error) {
    console.error('Error processing CSV:', error);
    return NextResponse.json({ error: 'Error processing CSV' }, { status: 500 });
  }
}

async function processRecord(record, mapping, apiUrl, apiKey) {
  const apiInputs = {};
  const outputMapping = {};

  mapping.forEach(map => {
    if (map.type === 'input') {
      apiInputs[map.apiParam] = record[map.csvColumn];
    } else {
      outputMapping[map.apiParam] = map.csvColumn;
    }
  });

  try {
    const apiResponse = await callAPI(apiInputs, apiUrl, apiKey);
    const processedRecord = { ...record };
    Object.entries(outputMapping).forEach(([apiParam, csvColumn]) => {
      processedRecord[csvColumn] = apiResponse.outputs[apiParam] || '';
    });
    return processedRecord;
  } catch (error) {
    return { ...record, error: error.message };
  }
}

async function callAPI(inputs, apiUrl, apiKey) {
  const retries = 3;
  let lastError;

  for (let i = 0; i < retries; i++) {
    try {
      const fullApiUrl = `${apiUrl.replace(/\/$/, '')}/workflows/run`;
      const response = await axios.post(fullApiUrl, {
        inputs: inputs,
        response_mode: "blocking",
        user: "api"
      }, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.data?.data?.outputs) {
        throw new Error('Invalid API response');
      }

      return response.data.data;
    } catch (error) {
      lastError = error;
      // 如果不是最后一次重试，等待一段时间后重试
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }

  throw lastError;
}

function parseCSV(fileContent) {
  return new Promise((resolve, reject) => {
    parse(fileContent, {
      columns: true,
      skip_empty_lines: true
    }, (err, records) => {
      if (err) reject(err);
      else resolve(records);
    });
  });
}
