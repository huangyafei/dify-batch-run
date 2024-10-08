import { parse } from 'csv-parse';
import { stringify } from 'csv-stringify/sync';
import axios from 'axios';
import { promises as fs } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

export async function POST(req) {
  const { fileContent, mapping, apiUrl, apiKey } = await req.json();
  
  if (!fileContent || !mapping || !apiUrl || !apiKey) {
    return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
  }

  try {
    const records = await parseCSV(fileContent);
    console.log('CSV parsing completed. Processing records...');
    const processedRecords = await processRecords(records, mapping, apiUrl, apiKey);
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
    parse(fileContent, {
      columns: true,
      skip_empty_lines: true
    }, (err, records) => {
      if (err) reject(err);
      else resolve(records);
    });
  });
}

async function processRecords(records, mapping, apiUrl, apiKey) {
  const processedRecords = [];
  for (const record of records) {
    try {
      const processedRecord = await processRecord(record, mapping, apiUrl, apiKey);
      processedRecords.push(processedRecord);
    } catch (error) {
      console.error('Error processing record:', error);
      processedRecords.push({...record, error: error.message});
    }
  }
  return processedRecords;
}

async function processRecord(record, mapping, apiUrl, apiKey) {
  console.log('Processing record:', record);
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
  console.log('API response:', apiResponse);

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
