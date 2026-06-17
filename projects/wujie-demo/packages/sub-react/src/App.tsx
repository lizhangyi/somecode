import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect, useCallback } from 'react'
import Overview from './pages/Overview'
import Detail from './pages/Detail'

function App() {
  const navigate = useNavigate()
  const location = useLocation()
  const [receivedMessages, setReceivedMessages] = useState<{ from: string; content: string }[]>([])
  const [commMessage, setCommMessage] = useState('')

  // 读取插件注入的配置
  const appConfig = (window as any).APP_CONFIG || null
  const propsInfo = (window as any).$wujie?.props || null

  // 监听 eventBus 消息
  useEffect(() => {
    const bus = (window as any).$wujie?.bus
    if (!bus) return

    const handler = (data: { from: string; message: string }) => {
      setReceivedMessages(prev => [{ from: data.from, content: data.message }, ...prev])
    }

    bus.$on('subMessage', handler)
    return () => bus.$off('subMessage', handler)
  }, [])

  const sendMessage = useCallback(() => {
    if (!commMessage.trim()) return
    const bus = (window as any).$wujie?.bus
    if (bus) {
      bus.$emit('subMessage', { from: 'sub-react', message: commMessage })
      setCommMessage('')
    }
  }, [commMessage])

  return (
    <div className="app-container">
      <div className="app-header">
        <span className="app-title">数据仪表盘</span>
        <span className="app-badge">sub-react | React</span>
      </div>

      {/* Props 信息 */}
      {propsInfo && (
        <div style={{
          marginBottom: 16, padding: '10px 14px', background: '#e6f7ff',
          border: '1px solid #91d5ff', borderRadius: 6, fontSize: 13, color: '#1890ff'
        }}>
          <strong>Props 通信:</strong> 模式: {propsInfo.mode} | 用户: {propsInfo.userInfo?.name}
        </div>
      )}

      {/* 导航 */}
      <div className="nav-tabs">
        <div
          className={`nav-tab ${location.pathname === '/' ? 'active' : ''}`}
          onClick={() => navigate('/')}
        >
          概览
        </div>
        <div
          className={`nav-tab ${location.pathname === '/detail' ? 'active' : ''}`}
          onClick={() => navigate('/detail')}
        >
          详情
        </div>
      </div>

      <Routes>
        <Route path="/" element={<Overview />} />
        <Route path="/detail" element={<Detail />} />
      </Routes>

      {/* 插件信息面板 */}
      <div className="plugin-panel">
        <h4>插件系统 (jsBeforeLoaders)</h4>
        <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
          以下配置由主应用通过插件在子应用加载前注入到 window.APP_CONFIG:
        </div>
        <div className="plugin-config">
          {appConfig ? JSON.stringify(appConfig, null, 2) : '未在微前端环境中 (独立运行时不注入)'}
        </div>
      </div>

      {/* 通信面板 */}
      <div className="comm-panel">
        <h4>eventBus 通信</h4>
        <div className="comm-input-group">
          <input
            className="comm-input"
            value={commMessage}
            onChange={e => setCommMessage(e.target.value)}
            placeholder="输入要发送的消息..."
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
          />
          <button className="comm-btn" onClick={sendMessage}>发送</button>
        </div>
        <div className="comm-log">
          {receivedMessages.length === 0 ? (
            <div style={{ color: '#999' }}>等待接收消息...</div>
          ) : (
            receivedMessages.map((msg, i) => (
              <div key={i} style={{ padding: '2px 0' }}>
                [{msg.from}] {msg.content}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default App
