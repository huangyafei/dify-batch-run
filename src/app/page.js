'use client'

import { useReducer } from 'react';
import axios from 'axios';

// 初始状态
const initialState = {
  file: null,
  mapping: [
    { csvColumn: '', apiParam: '', type: 'input' },
    { csvColumn: '', apiParam: '', type: 'output' }
  ],
  progress: {
    processing: false,
    percent: 0,
    total: 0,
    processed: 0
  },
  download: {
    blob: null,
    fileName: null
  },
  error: null,
  config: {
    apiUrl: 'https://api.dify.ai/v1',
    apiKey: '',
    concurrencyLimit: 5
  }
};

// Action Types
const ACTIONS = {
  SET_FILE: 'SET_FILE',
  UPDATE_MAPPING: 'UPDATE_MAPPING',
  ADD_MAPPING: 'ADD_MAPPING',
  REMOVE_MAPPING: 'REMOVE_MAPPING',
  SET_PROGRESS: 'SET_PROGRESS',
  SET_DOWNLOAD: 'SET_DOWNLOAD',
  SET_ERROR: 'SET_ERROR',
  UPDATE_CONFIG: 'UPDATE_CONFIG',
  RESET_PROGRESS: 'RESET_PROGRESS',
  SET_MAPPING: 'SET_MAPPING'
};

// Reducer
function reducer(state, action) {
  switch (action.type) {
    case ACTIONS.SET_FILE:
      return { ...state, file: action.payload };
    case ACTIONS.UPDATE_MAPPING:
      const newMapping = [...state.mapping];
      newMapping[action.payload.index][action.payload.field] = action.payload.value;
      return { ...state, mapping: newMapping };
    case ACTIONS.ADD_MAPPING:
      return {
        ...state,
        mapping: [...state.mapping, { csvColumn: '', apiParam: '', type: action.payload }]
      };
    case ACTIONS.REMOVE_MAPPING:
      return {
        ...state,
        mapping: state.mapping.filter((_, i) => i !== action.payload)
      };
    case ACTIONS.SET_PROGRESS:
      return {
        ...state,
        progress: {
          ...state.progress,
          ...action.payload
        }
      };
    case ACTIONS.SET_DOWNLOAD:
      return {
        ...state,
        download: action.payload
      };
    case ACTIONS.SET_ERROR:
      return { ...state, error: action.payload };
    case ACTIONS.UPDATE_CONFIG:
      return {
        ...state,
        config: {
          ...state.config,
          ...action.payload
        }
      };
    case ACTIONS.RESET_PROGRESS:
      return {
        ...state,
        progress: {
          processing: false,
          percent: 0,
          total: 0,
          processed: 0
        },
        download: {
          blob: null,
          fileName: null
        },
        error: null
      };
    case ACTIONS.SET_MAPPING:
      return {
        ...state,
        mapping: action.payload
      };
    default:
      return state;
  }
}

export default function Home() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { file, mapping, progress, download, error, config } = state;

  const handleFileChange = (event) => {
    dispatch({ type: ACTIONS.SET_FILE, payload: event.target.files[0] });
  };

  const handleMappingChange = (index, field, value) => {
    dispatch({
      type: ACTIONS.UPDATE_MAPPING,
      payload: { index, field, value }
    });
  };

  const addMapping = (type) => {
    dispatch({ type: ACTIONS.ADD_MAPPING, payload: type });
  };

  const removeMapping = (index) => {
    const typeToRemove = mapping[index].type;
    const remainingOfType = mapping.filter((m, i) => i !== index && m.type === typeToRemove).length;
    
    if (remainingOfType === 0) {
      return; // 如果是最后一个该类型的映射，不允许删除
    }
    
    dispatch({ type: ACTIONS.REMOVE_MAPPING, payload: index });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!file || !config.apiUrl || !config.apiKey) return;

    dispatch({ type: ACTIONS.RESET_PROGRESS });
    dispatch({ type: ACTIONS.SET_PROGRESS, payload: { processing: true } });
    
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
            apiUrl: config.apiUrl,
            apiKey: config.apiKey,
            concurrencyLimit: parseInt(config.concurrencyLimit)
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

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('progress:')) {
              const [processed, total] = line.replace('progress:', '').split('/');
              dispatch({
                type: ACTIONS.SET_PROGRESS,
                payload: {
                  processed: parseInt(processed),
                  total: parseInt(total),
                  percent: (parseInt(processed) / parseInt(total)) * 100
                }
              });
            } else {
              finalCsvData += line + '\n';
            }
          }
        }

        if (buffer) {
          finalCsvData += buffer;
        }

        const csvBlob = new Blob([finalCsvData], { type: 'text/csv' });
        const fileName = `processed_${Date.now()}.csv`;
        dispatch({
          type: ACTIONS.SET_DOWNLOAD,
          payload: { blob: csvBlob, fileName }
        });
      } catch (error) {
        console.error('Error:', error);
        dispatch({ type: ACTIONS.SET_ERROR, payload: error.message || 'An unknown error occurred' });
      } finally {
        dispatch({ type: ACTIONS.SET_PROGRESS, payload: { processing: false } });
      }
    };
    reader.readAsText(file);
  };

  const handleDownload = () => {
    if (download.blob && download.fileName) {
      const url = window.URL.createObjectURL(download.blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', download.fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    }
  };

  const handleAutoFill = async () => {
    try {
      const response = await fetch('/api/get-parameters', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiUrl: config.apiUrl,
          apiKey: config.apiKey
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch parameters');
      }

      const data = await response.json();
      if (data.user_input_form) {
        // 清除现有的输入映射
        const newMapping = [...state.mapping.filter(m => m.type === 'output')];
        
        // 添加新的输入映射
        data.user_input_form.forEach(input => {
          const [key, value] = Object.entries(input)[0];
          newMapping.push({ csvColumn: '', apiParam: value.variable, type: 'input' });
        });

        dispatch({ 
          type: ACTIONS.SET_MAPPING, 
          payload: newMapping 
        });
      }
    } catch (error) {
      console.error('Error:', error);
      dispatch({ type: ACTIONS.SET_ERROR, payload: error.message });
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
                value={config.apiUrl}
                onChange={(e) => dispatch({
                  type: ACTIONS.UPDATE_CONFIG,
                  payload: { apiUrl: e.target.value }
                })}
                className="w-full px-3 py-2 bg-[#3a3a3c] rounded-md text-sm"
                placeholder="例如：https://api.dify.ai/v1"
                required
              />
              <p className="mt-1 text-xs text-gray-400">
                请输入 Dify API 的基础 URL，例如：https://api.dify.ai/v1
              </p>
            </div>

            <div>
              <label htmlFor="apiKey" className="block text-sm font-medium mb-2">
                API Key
              </label>
              <input
                type="text"
                id="apiKey"
                value={config.apiKey}
                onChange={(e) => dispatch({
                  type: ACTIONS.UPDATE_CONFIG,
                  payload: { apiKey: e.target.value }
                })}
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
                value={config.concurrencyLimit}
                onChange={(e) => dispatch({
                  type: ACTIONS.UPDATE_CONFIG,
                  payload: { concurrencyLimit: e.target.value }
                })}
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
                accept=".csv"
                onChange={handleFileChange}
                className="w-full px-3 py-2 bg-[#3a3a3c] rounded-md text-sm"
                required
              />
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium">输入字段映射</h3>
                  <div>
                  <button
                      type="button"
                      onClick={handleAutoFill}
                      className="px-3 py-1 bg-yellow-600 rounded-md text-sm"
                    >
                      一键填入
                    </button>
                    <button
                      type="button"
                      onClick={() => addMapping('input')}
                      className="ml-2 px-3 py-1 bg-blue-600 rounded-md text-sm"
                    >
                      添加输入
                    </button>
                  </div>
                </div>

                {mapping.filter(map => map.type === 'input').map((map, index) => {
                  const mappingIndex = mapping.findIndex(m => m === map);
                  const isOnlyOneOfType = mapping.filter(m => m.type === 'input').length === 1;
                  
                  return (
                    <div key={`input-${index}`} className="flex space-x-2 mb-2">
                      <input
                        type="text"
                        value={map.csvColumn}
                        onChange={(e) => handleMappingChange(
                          mappingIndex,
                          'csvColumn',
                          e.target.value
                        )}
                        placeholder="CSV 列名"
                        className="flex-1 px-3 py-2 bg-[#3a3a3c] rounded-md text-sm"
                      />
                      <input
                        type="text"
                        value={map.apiParam}
                        onChange={(e) => handleMappingChange(
                          mappingIndex,
                          'apiParam',
                          e.target.value
                        )}
                        placeholder="API 参数名"
                        className="flex-1 px-3 py-2 bg-[#3a3a3c] rounded-md text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => removeMapping(mappingIndex)}
                        disabled={isOnlyOneOfType}
                        className={`px-3 py-2 rounded-md text-sm ${
                          isOnlyOneOfType
                            ? 'bg-gray-600 cursor-not-allowed'
                            : 'bg-red-600 hover:bg-red-700'
                        }`}
                      >
                        删除
                      </button>
                    </div>
                  );
                })}
              </div>

              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium">输出字段映射</h3>
                  <button
                    type="button"
                    onClick={() => addMapping('output')}
                    className="px-3 py-1 bg-green-600 rounded-md text-sm"
                  >
                    添加输出
                  </button>
                </div>

                {mapping.filter(map => map.type === 'output').map((map, index) => {
                  const mappingIndex = mapping.findIndex(m => m === map);
                  const isOnlyOneOfType = mapping.filter(m => m.type === 'output').length === 1;
                  
                  return (
                    <div key={`output-${index}`} className="flex space-x-2 mb-2">
                      <input
                        type="text"
                        value={map.csvColumn}
                        onChange={(e) => handleMappingChange(
                          mappingIndex,
                          'csvColumn',
                          e.target.value
                        )}
                        placeholder="CSV 列名"
                        className="flex-1 px-3 py-2 bg-[#3a3a3c] rounded-md text-sm"
                      />
                      <input
                        type="text"
                        value={map.apiParam}
                        onChange={(e) => handleMappingChange(
                          mappingIndex,
                          'apiParam',
                          e.target.value
                        )}
                        placeholder="API 参数名"
                        className="flex-1 px-3 py-2 bg-[#3a3a3c] rounded-md text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => removeMapping(mappingIndex)}
                        disabled={isOnlyOneOfType}
                        className={`px-3 py-2 rounded-md text-sm ${
                          isOnlyOneOfType
                            ? 'bg-gray-600 cursor-not-allowed'
                            : 'bg-red-600 hover:bg-red-700'
                        }`}
                      >
                        删除
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={progress.processing}
                className={`w-full py-2 rounded-md text-sm font-medium ${
                  progress.processing
                    ? 'bg-gray-600 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {progress.processing ? '处理中...' : '开始处理'}
              </button>
            </div>
          </form>

          {progress.processing && (
            <div className="mt-4">
              <div className="flex justify-between text-sm mb-1">
                <span>处理进度</span>
                <span>{progress.processed} / {progress.total}</span>
              </div>
              <div className="w-full bg-[#3a3a3c] rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${progress.percent}%` }}
                ></div>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-900/50 text-red-200 rounded-md">
              {error}
            </div>
          )}

          {download.blob && (
            <div className="mt-4">
              <button
                onClick={handleDownload}
                className="w-full py-2 bg-green-600 hover:bg-green-700 rounded-md text-sm font-medium"
              >
                下载处理结果
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
