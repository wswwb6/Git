import React, { useState, useEffect } from 'react';
import { Carousel, Card, Row, Col, Input, Select } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import axios from 'axios';
import './HomePage.css';

const { Search } = Input;
const { Option } = Select;

const HomePage = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('default');

  useEffect(() => {
    fetchProducts();
  }, [sortBy]);

  const fetchProducts = async () => {
    try {
      const res = await axios.get('/api/products', {
        params: { sort: sortBy }
      });
      setProducts(res.data);
      setLoading(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSearch = (value) => {
    // 实现搜索功能
    console.log('Search:', value);
  };

  const handleSortChange = (value) => {
    setSortBy(value);
  };

  return (
    <div className="home-container">
      <Carousel autoplay className="banner">
        <div>
          <img src="/images/banner1.jpg" alt="Banner 1" />
        </div>
        <div>
          <img src="/images/banner2.jpg" alt="Banner 2" />
        </div>
      </Carousel>

      <div className="search-bar">
        <Search
          placeholder="搜索商品"
          allowClear
          enterButton="搜索"
          size="large"
          onSearch={handleSearch}
          prefix={<SearchOutlined />}
        />
        <Select
          defaultValue="default"
          style={{ width: 200, marginLeft: 16 }}
          onChange={handleSortChange}
        >
          <Option value="default">默认排序</Option>
          <Option value="price_asc">价格从低到高</Option>
          <Option value="price_desc">价格从高到低</Option>
          <Option value="rating">好评优先</Option>
          <Option value="sales">销量优先</Option>
        </Select>
      </div>

      <div className="product-list">
        <Row gutter={[16, 16]}>
          {products.map((product) => (
            <Col xs={24} sm={12} md={8} lg={6} key={product._id}>
              <Card
                hoverable
                cover={<img alt={product.name} src={product.images[0]} />}
                onClick={() => window.location.href = `/product/${product._id}`}
              >
                <Card.Meta
                  title={product.name}
                  description={`¥${product.price} · 销量 ${product.sales}`}
                />
              </Card>
            </Col>
          ))}
        </Row>
      </div>
    </div>
  );
};

export default HomePage;
