import { parse } from 'csv-parse';
import { stringify } from 'csv-stringify/sync';
import axios from 'axios';
import { promises as fs } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

export async function POST(req) {
  const { fileContent } = await req.json();
  
  if (!fileContent) {
    return NextResponse.json({ error: 'No file content provided' }, { status: 400 });
  }

  try {
    const records = await parseCSV(fileContent);
    console.log('CSV parsing completed. Processing records...');
    const processedRecords = await processRecords(records);
    console.log('All records processed. Generating output file...');
    const output = stringify(processedRecords, { header: true });
    const fileName = `processed_${Date.now()}.csv`;
    const filePath = path.join('./public', fileName);
    
    try {
      await fs.writeFile(filePath, output);
      console.log('File written successfully:', filePath);
      return NextResponse.json({ downloadUrl: `/${fileName}` });
    } catch (writeError) {
      console.error('Error writing file:', writeError);
      return NextResponse.json({ error: 'Error writing output file' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error processing CSV:', error);
    return NextResponse.json({ error: 'Error processing CSV' }, { status: 500 });
  }
}

function parseCSV(fileContent) {
  return new Promise((resolve, reject) => {
    const records = [];
    const parser = parse({
      columns: true,
      skip_empty_lines: true
    });

    parser.on('readable', function() {
      let record;
      while (record = this.read()) {
        records.push(record);
      }
    });

    parser.on('error', function(err) {
      reject(err);
    });

    parser.on('end', function() {
      resolve(records);
    });

    parser.write(fileContent);
    parser.end();
  });
}

async function processRecords(records) {
  const processedRecords = [];
  for (const record of records) {
    try {
      const processedRecord = await processRecord(record);
      processedRecords.push(processedRecord);
    } catch (error) {
      console.error('Error processing record:', error);
      processedRecords.push({...record, error: error.message});
    }
  }
  return processedRecords;
}

async function processRecord(record) {
  console.log('Processing record:', record);
  const apiResponse = await callAPI(record);
  console.log('API response:', apiResponse);

  const { text, biaozhundaan, cihuibiao } = apiResponse.outputs;

  return {
    ...record,
    text: text || '',
    biaozhundaan: biaozhundaan || '',
    cihuibiao: cihuibiao || ''
  };
}

async function callAPI(record) {
  try {
    const response = await axios.post('http://localhost/v1/workflows/run', {
      inputs: {
        article: record.article,
        article_title: record.article_title,
        article_grade: record.article_grade,
        "sys.files": []
      },
      response_mode: "blocking",
      user: "api"
    }, {
      headers: {
        'Authorization': 'Bearer app-J3MlqDdd2xFdGu82NR415kD2',
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

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
  },
};
