'use client'

import { useState } from 'react';
import axios from 'axios';

export default function Home() {
  const [file, setFile] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [error, setError] = useState(null);

  const handleFileChange = (event) => {
    setFile(event.target.files[0]);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!file) return;

    setProcessing(true);
    setError(null);
    setDownloadUrl(null);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const response = await axios.post('/api/process-csv', { fileContent: e.target.result });
        if (response.data.error) {
          throw new Error(response.data.error);
        }
        setDownloadUrl(response.data.downloadUrl);
      } catch (error) {
        setError(error.message || 'An unknown error occurred');
      } finally {
        setProcessing(false);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-md p-6 w-full max-w-md">
        <h1 className="text-2xl font-bold mb-4">CSV API Processor</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="csvFile" className="block text-sm font-medium text-gray-700 mb-1">
              Upload CSV File
            </label>
            <input
              type="file"
              id="csvFile"
              onChange={handleFileChange}
              accept=".csv"
              className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>
          <button
            type="submit"
            disabled={!file || processing}
            className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {processing ? 'Processing...' : 'Process CSV'}
          </button>
        </form>
        {error && <p className="mt-4 text-red-600">Error: {error}</p>}
        {processing && <p className="mt-4 text-gray-600">Processing... This may take a while.</p>}
        {downloadUrl && (
          <p className="mt-4">
            Processing complete!{' '}
            <a href={downloadUrl} download className="text-blue-600 hover:text-blue-800">
              Download processed CSV
            </a>
          </p>
        )}
      </div>
    </div>
  );
}
