import { NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(req) {
  try {
    const { apiUrl, apiKey } = await req.json();

    if (!apiUrl || !apiKey) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const response = await axios.get(`${apiUrl}/parameters`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    return NextResponse.json(response.data);
  } catch (error) {
    console.error('Error fetching parameters:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch parameters' }, 
      { status: 500 }
    );
  }
} 