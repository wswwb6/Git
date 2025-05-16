import React, { useState, useEffect } from 'react';
import { List, Avatar, Tag, Button, message } from 'antd';
import { Link } from 'react-router-dom';
import api from '../../api';

const OrderHistory = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const response = await api.get('/orders/user/me');
      setOrders(response.data);
    } catch (error) {
      message.error('获取订单历史失败');
    } finally {
      setLoading(false);
    }
  };

  const getStatusTag = (status) => {
    const statusMap = {
      pending: { color: 'orange', text: '待支付' },
      paid: { color: 'blue', text: '已支付' },
      shipped: { color: 'purple', text: '已发货' },
      completed: { color: 'green', text: '已完成' },
      returned: { color: 'red', text: '已退货' }
    };
    return <Tag color={statusMap[status]?.color}>{statusMap[status]?.text}</Tag>;
  };

  return (
    <div className="order-history">
      <h2>我的订单</h2>
      <List
        itemLayout="horizontal"
        dataSource={orders}
        loading={loading}
        renderItem={(order) => (
          <List.Item
            actions={[
              <Link to={`/orders/${order.id}`}>
                <Button type="link">查看详情</Button>
              </Link>
            ]}
          >
            <List.Item.Meta
              avatar={<Avatar src="https://joeschmoe.io/api/v1/random" />}
              title={`订单号: ${order.id}`}
              description={
                <>
                  <div>卖家: {order.seller_name || '平台自营'}</div>
                  <div>创建时间: {new Date(order.created_at).toLocaleString()}</div>
                  <div>商品数量: {order.item_count}</div>
                  <div>总金额: ¥{order.total_amount}</div>
                </>
              }
            />
            {getStatusTag(order.status)}
          </List.Item>
        )}
      />
    </div>
  );
};

export default OrderHistory;
