export default function Detail() {
  const orders = [
    { id: 'ORD001', customer: '张三', amount: '¥1,280', status: '已完成' },
    { id: 'ORD002', customer: '李四', amount: '¥3,450', status: '待发货' },
    { id: 'ORD003', customer: '王五', amount: '¥890', status: '已退款' },
    { id: 'ORD004', customer: '赵六', amount: '¥2,100', status: '已完成' },
    { id: 'ORD005', customer: '钱七', amount: '¥5,670', status: '待付款' },
    { id: 'ORD006', customer: '孙八', amount: '¥1,890', status: '已完成' }
  ]

  const statusColor: Record<string, string> = {
    '已完成': '#52c41a',
    '待发货': '#fa8c16',
    '已退款': '#999',
    '待付款': '#f5222d'
  }

  return (
    <div>
      <table className="data-table">
        <thead>
          <tr>
            <th>订单号</th>
            <th>客户</th>
            <th>金额</th>
            <th>状态</th>
          </tr>
        </thead>
        <tbody>
          {orders.map(order => (
            <tr key={order.id}>
              <td style={{ fontFamily: 'monospace', color: '#1890ff' }}>{order.id}</td>
              <td>{order.customer}</td>
              <td style={{ fontWeight: 'bold' }}>{order.amount}</td>
              <td>
                <span style={{
                  padding: '2px 8px', borderRadius: 4, fontSize: 12,
                  color: statusColor[order.status] || '#666',
                  background: `${statusColor[order.status]}15`,
                  border: `1px solid ${statusColor[order.status]}30`
                }}>
                  {order.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{
        marginTop: 16, padding: 12, background: '#fff7e6',
        border: '1px solid #ffd591', borderRadius: 6, fontSize: 13, color: '#fa8c16'
      }}>
        <strong>路由同步说明:</strong> 开启 sync 后，点击上方的"概览"/"详情"切换路由，
        主应用 URL 也会同步更新，支持浏览器前进/后退。
      </div>
    </div>
  )
}
