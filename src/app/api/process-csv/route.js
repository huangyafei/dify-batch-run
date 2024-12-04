import { parse } from 'csv-parse';
import { stringify } from 'csv-stringify/sync';
import axios from 'axios';
import { promises as fs } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

export async function POST(req) {
  const { fileContent, mapping, apiUrl, apiKey, concurrencyLimit } = await req.json();
  
  if (!fileContent || !mapping || !apiUrl || !apiKey) {
    return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
  }

  try {
    const records = await parseCSV(fileContent);
    console.log('CSV parsing completed. Total records:', records.length);

    // 创建用于进度报告的编码器和流
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const processedRecords = [];
          const totalRecords = records.length;

          // 发送初始进度
          controller.enqueue(encoder.encode(`progress:0/${totalRecords}\n`));

          // 分批处理记录
          for (let i = 0; i < records.length; i += concurrencyLimit) {
            const batch = records.slice(i, i + concurrencyLimit);
            const promises = batch.map(record => 
              processRecord(record, mapping, apiUrl, apiKey)
                .catch(error => {
                  console.error('处理记录时出错:', error);
                  return {...record, error: error.message};
                })
            );

            const results = await Promise.all(promises);
            processedRecords.push(...results);
            
            // 发送进度更新
            controller.enqueue(encoder.encode(`progress:${processedRecords.length}/${totalRecords}\n`));
            console.log(`已处理 ${processedRecords.length} 条记录，共 ${totalRecords} 条`);
          }

          // 发送最终的 CSV 数据
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

  const apiResponse = await callAPI(apiInputs, apiUrl, apiKey);

  const processedRecord = {...record};
  Object.entries(outputMapping).forEach(([apiParam, csvColumn]) => {
    processedRecord[csvColumn] = apiResponse.outputs[apiParam] || '';
  });

  return processedRecord;
}

async function callAPI(inputs, apiUrl, apiKey) {
  try {
    const response = await axios.post(apiUrl, {
      inputs: inputs,
      response_mode: "blocking",
      user: "api"
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.data || !response.data.data || !response.data.data.outputs) {
      throw new Error('Invalid API response');
    }

    return response.data.data;
  } catch (error) {
    console.error('API call error:', error.message);
    throw error;
  }
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
