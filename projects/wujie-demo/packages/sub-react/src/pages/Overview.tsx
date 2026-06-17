export default function Overview() {
  const metrics = [
    { title: '总用户数', value: '12,845', change: '+12.5%', up: true },
    { title: '活跃用户', value: '8,234', change: '+8.2%', up: true },
    { title: '今日营收', value: '¥56,780', change: '+23.1%', up: true },
    { title: '待处理订单', value: '142', change: '-5.3%', up: false }
  ]

  return (
    <div>
      <div className="dashboard-grid">
        {metrics.map((m, i) => (
          <div className="dash-card" key={i}>
            <div className="dash-card-title">{m.title}</div>
            <div className="dash-card-value">{m.value}</div>
            <div className={`dash-card-change ${m.up ? 'up' : 'down'}`}>
              {m.up ? '↑' : '↓'} {m.change} 较昨日
            </div>
          </div>
        ))}
      </div>

      <div style={{
        padding: 12, background: '#e6fffb', border: '1px solid #87e8de',
        borderRadius: 6, fontSize: 13, color: '#13c2c2'
      }}>
        <strong>跨框架说明:</strong> 这是一个 React 应用，运行在 Vue3 主应用中。
        无界基于 Web Components + iframe 沙箱，实现技术栈完全无关的微前端架构。
      </div>
    </div>
  )
}
