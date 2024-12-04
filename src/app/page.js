'use client'

import { useState } from 'react';
import axios from 'axios';

export default function Home() {
  const [file, setFile] = useState(null);
  const [mapping, setMapping] = useState([
    { csvColumn: '', apiParam: '', type: 'input' },
    { csvColumn: '', apiParam: '', type: 'output' }
  ]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [totalRecords, setTotalRecords] = useState(0);
  const [processedRecords, setProcessedRecords] = useState(0);
  const [downloadBlob, setDownloadBlob] = useState(null);
  const [downloadFileName, setDownloadFileName] = useState(null);
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

  const addMapping = (type) => {
    setMapping([...mapping, { csvColumn: '', apiParam: '', type }]);
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
    setDownloadBlob(null);
    setProgress(0);
    setProcessedRecords(0);
    setTotalRecords(0);
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const response = await fetch('/api/process-csv', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fileContent: e.target.result,
            mapping: mapping,
            apiUrl: apiUrl,
            apiKey: apiKey,
            concurrencyLimit: parseInt(concurrencyLimit)
          }),
        });

        if (!response.ok) {
          throw new Error('Network response was not ok');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let finalCsvData = '';

        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            break;
          }

          // 解码新的数据块并添加到缓冲区
          buffer += decoder.decode(value, { stream: true });
          
          // 处理缓冲区中的完整行
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // 保留最后一个不完整的行

          for (const line of lines) {
            if (line.startsWith('progress:')) {
              const [processed, total] = line.replace('progress:', '').split('/');
              setProcessedRecords(parseInt(processed));
              setTotalRecords(parseInt(total));
              setProgress((parseInt(processed) / parseInt(total)) * 100);
            } else {
              finalCsvData += line + '\n';
            }
          }
        }

        // 处理剩余的缓冲区
        if (buffer) {
          finalCsvData += buffer;
        }

        // 创建最终的 Blob
        const csvBlob = new Blob([finalCsvData], { type: 'text/csv' });
        const fileName = `processed_${Date.now()}.csv`;
        setDownloadBlob(csvBlob);
        setDownloadFileName(fileName);
      } catch (error) {
        console.error('Error:', error);
        setError(error.message || 'An unknown error occurred');
      } finally {
        setProcessing(false);
      }
    };
    reader.readAsText(file);
  };

  const handleDownload = () => {
    if (downloadBlob && downloadFileName) {
      const url = window.URL.createObjectURL(downloadBlob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', downloadFileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="min-h-screen bg-[#1c1c1e] text-white pt-12 pb-10 px-4 sm:px-6 lg:px-8">
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
              
              {/* 输入参数部分 */}
              <div className="mb-4">
                <h4 className="text-sm font-medium mb-2 text-gray-400">输入参数</h4>
                <div className="space-y-3">
                  {mapping.filter(map => map.type === 'input').map((map, index, inputArray) => (
                    <div key={`input-${index}`} className="flex items-center space-x-2">
                      <input
                        type="text"
                        placeholder="表格字段"
                        value={map.csvColumn}
                        onChange={(e) => {
                          const realIndex = mapping.findIndex(m => m === map);
                          handleMappingChange(realIndex, 'csvColumn', e.target.value);
                        }}
                        className="flex-1 px-3 py-2 bg-[#3a3a3c] rounded-md text-sm"
                      />
                      <input
                        type="text"
                        placeholder="API 参数"
                        value={map.apiParam}
                        onChange={(e) => {
                          const realIndex = mapping.findIndex(m => m === map);
                          handleMappingChange(realIndex, 'apiParam', e.target.value);
                        }}
                        className="flex-1 px-3 py-2 bg-[#3a3a3c] rounded-md text-sm"
                      />
                      {inputArray.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const realIndex = mapping.findIndex(m => m === map);
                            removeMapping(realIndex);
                          }}
                          className="p-2 bg-red-600 rounded-full"
                        >
                          <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => addMapping('input')}
                  className="mt-3 px-4 py-2 bg-blue-600 rounded-md text-sm font-medium"
                >
                  添加输入映射
                </button>
              </div>

              {/* 输出参数部分 */}
              <div>
                <h4 className="text-sm font-medium mb-2 text-gray-400">输出参数</h4>
                <div className="space-y-3">
                  {mapping.filter(map => map.type === 'output').map((map, index, outputArray) => (
                    <div key={`output-${index}`} className="flex items-center space-x-2">
                      <input
                        type="text"
                        placeholder="表格字段"
                        value={map.csvColumn}
                        onChange={(e) => {
                          const realIndex = mapping.findIndex(m => m === map);
                          handleMappingChange(realIndex, 'csvColumn', e.target.value);
                        }}
                        className="flex-1 px-3 py-2 bg-[#3a3a3c] rounded-md text-sm"
                      />
                      <input
                        type="text"
                        placeholder="API 参数"
                        value={map.apiParam}
                        onChange={(e) => {
                          const realIndex = mapping.findIndex(m => m === map);
                          handleMappingChange(realIndex, 'apiParam', e.target.value);
                        }}
                        className="flex-1 px-3 py-2 bg-[#3a3a3c] rounded-md text-sm"
                      />
                      {outputArray.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const realIndex = mapping.findIndex(m => m === map);
                            removeMapping(realIndex);
                          }}
                          className="p-2 bg-red-600 rounded-full"
                        >
                          <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => addMapping('output')}
                  className="mt-3 px-4 py-2 bg-blue-600 rounded-md text-sm font-medium"
                >
                  添加输出映射
                </button>
              </div>
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
            <div className="mt-4 space-y-2">
              <div className="w-full bg-[#3a3a3c] rounded-full h-4">
                <div
                  className="bg-blue-600 h-4 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <div className="text-sm text-center">
                {processedRecords} / {totalRecords} 条记录已处理 ({Math.round(progress)}%)
              </div>
            </div>
          )}

          {downloadBlob && (
            <div className="mt-4 bg-green-900 border-l-4 border-green-500 p-4 rounded-md">
              <p className="text-sm flex items-center justify-between">
                <span>处理完成！</span>
                <button
                  onClick={handleDownload}
                  className="px-4 py-2 bg-green-600 rounded-md hover:bg-green-700 transition-colors"
                >
                  下载 CSV 文件
                </button>
              </p>
            </div>
          )}
        </div>
      </div>
      
      <footer className="mt-4 text-center text-sm text-gray-500">
        <p>♥️ Made by TPLN AI PM Team with love</p>
      </footer>
    </div>
  );
}
