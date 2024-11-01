'use client'

import { useState } from 'react';
import axios from 'axios';

export default function Home() {
  const [file, setFile] = useState(null);
  const [mapping, setMapping] = useState([{ csvColumn: '', apiParam: '', type: 'input' }]);
  const [processing, setProcessing] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [error, setError] = useState(null);
  const [apiUrl, setApiUrl] = useState('https://api.dify.ai/v1/workflows/run');
  const [apiKey, setApiKey] = useState('');
  const [concurrencyLimit, setConcurrencyLimit] = useState(5);

  const handleFileChange = (event) => {
    setFile(event.target.files[0]);
  };

  const handleMappingChange = (index, field, value) => {
    const newMapping = [...mapping];
    newMapping[index][field] = value;
    setMapping(newMapping);
  };

  const addMapping = () => {
    setMapping([...mapping, { csvColumn: '', apiParam: '', type: 'input' }]);
  };

  const removeMapping = (index) => {
    const newMapping = mapping.filter((_, i) => i !== index);
    setMapping(newMapping);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!file || !apiUrl || !apiKey) return;

    setProcessing(true);
    setError(null);
    setDownloadUrl(null);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const response = await axios.post('/api/process-csv', {
          fileContent: e.target.result,
          mapping: mapping,
          apiUrl: apiUrl,
          apiKey: apiKey,
          concurrencyLimit: parseInt(concurrencyLimit)
        });
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
    <div className="min-h-screen bg-[#1c1c1e] text-white pt-24 pb-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-12">Dify 批量运行工具</h1>
        <div className="bg-[#2c2c2e] rounded-lg shadow-lg p-6 mb-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="apiUrl" className="block text-sm font-medium mb-2">
                API URL
              </label>
              <input
                type="text"
                id="apiUrl"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                className="w-full px-3 py-2 bg-[#3a3a3c] rounded-md text-sm"
                required
              />
            </div>

            <div>
              <label htmlFor="apiKey" className="block text-sm font-medium mb-2">
                API Key
              </label>
              <input
                type="text"
                id="apiKey"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full px-3 py-2 bg-[#3a3a3c] rounded-md text-sm"
                required
              />
            </div>

            <div>
              <label htmlFor="concurrencyLimit" className="block text-sm font-medium mb-2">
                并发限制
              </label>
              <input
                type="number"
                id="concurrencyLimit"
                min="1"
                max="50"
                value={concurrencyLimit}
                onChange={(e) => setConcurrencyLimit(e.target.value)}
                className="w-full px-3 py-2 bg-[#3a3a3c] rounded-md text-sm"
                required
              />
              <p className="mt-1 text-xs text-gray-400">
                请输入 1-50 之间的数字，数字越大并发量越高，但同时可能会超过 API 请求频率限制。
              </p>
            </div>

            <div>
              <label htmlFor="csvFile" className="block text-sm font-medium mb-2">
                上传 CSV 文件
              </label>
              <input
                type="file"
                id="csvFile"
                onChange={handleFileChange}
                accept=".csv"
                className="w-full px-3 py-2 bg-[#3a3a3c] rounded-md text-sm"
                required
              />
            </div>

            <div>
              <h3 className="text-lg font-medium mb-3">参数映射</h3>
              <div className="space-y-3">
                {mapping.map((map, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <input
                      type="text"
                      placeholder="表格字段"
                      value={map.csvColumn}
                      onChange={(e) => handleMappingChange(index, 'csvColumn', e.target.value)}
                      className="flex-1 px-3 py-2 bg-[#3a3a3c] rounded-md text-sm"
                    />
                    <input
                      type="text"
                      placeholder="API 参数"
                      value={map.apiParam}
                      onChange={(e) => handleMappingChange(index, 'apiParam', e.target.value)}
                      className="flex-1 px-3 py-2 bg-[#3a3a3c] rounded-md text-sm"
                    />
                    <select
                      value={map.type}
                      onChange={(e) => handleMappingChange(index, 'type', e.target.value)}
                      className="px-3 py-2 bg-[#3a3a3c] rounded-md text-sm"
                    >
                      <option value="input">输入</option>
                      <option value="output">输出</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => removeMapping(index)}
                      className="p-2 bg-red-600 rounded-full"
                    >
                      <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addMapping}
                className="mt-3 px-4 py-2 bg-blue-600 rounded-md text-sm font-medium"
              >
                添加映射
              </button>
            </div>

            <div>
              <button
                type="submit"
                disabled={!file || !apiUrl || !apiKey || processing}
                className="w-full py-2 px-4 bg-blue-600 rounded-md text-sm font-medium disabled:opacity-50"
              >
                {processing ? '处理中...' : '开始处理'}
              </button>
            </div>
          </form>

          {error && (
            <div className="mt-4 bg-red-900 border-l-4 border-red-500 p-4 rounded-md">
              <p className="text-sm">
                {error}
              </p>
            </div>
          )}

          {processing && (
            <div className="mt-4 text-center">
              <svg className="animate-spin h-5 w-5 text-blue-500 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="mt-2 text-sm">处理中，请稍候...</p>
            </div>
          )}

          {downloadUrl && (
            <div className="mt-4 bg-green-900 border-l-4 border-green-500 p-4 rounded-md">
              <p className="text-sm">
                处理完成！
                <a href={downloadUrl} download className="font-medium underline hover:text-green-400 ml-1">
                  下载处理后的CSV
                </a>
              </p>
            </div>
          )}
        </div>
      </div>
      
      <footer className="mt-8 text-center text-sm text-gray-500">
        <p>♥️ Made by TPLN AI PM Team with love</p>
      </footer>
    </div>
  );
}
