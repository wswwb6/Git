import asyncHandler from 'express-async-handler'
import Order from '../models/orderModel.js'
import Product from '../models/productModel.js'
import User from '../models/userModel.js'

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
const addOrderItems = asyncHandler(async (req, res) => {
  const {
    orderItems,
    shippingAddress,
    paymentMethod,
    itemsPrice,
    shippingPrice,
    taxPrice,
    totalPrice,
  } = req.body

  if (orderItems && orderItems.length === 0) {
    res.status(400)
    throw new Error('No order items')
  } else {
    // Calculate platform fee (5% of total price)
    const platformFee = totalPrice * 0.05
    const finalTotalPrice = totalPrice + platformFee

    const order = new Order({
      orderItems,
      user: req.user._id,
      shippingAddress,
      paymentMethod,
      itemsPrice,
      shippingPrice,
      taxPrice,
      platformFee,
      totalPrice: finalTotalPrice,
    })

    const createdOrder = await order.save()

    // Update product stock
    for (const item of orderItems) {
      const product = await Product.findById(item.product)
      if (product) {
        product.countInStock -= item.qty
        product.sold += item.qty
        await product.save()
      }
    }

    res.status(201).json(createdOrder)
  }
})

// @desc    Get order by ID
// @route   GET /api/orders/:id
// @access  Private
const getOrderById = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).populate('user', 'name email')

  if (order) {
    res.json(order)
  } else {
    res.status(404)
    throw new Error('Order not found')
  }
})

// @desc    Update order to paid
// @route   PUT /api/orders/:id/pay
// @access  Private
const updateOrderToPaid = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id)

  if (order) {
    order.isPaid = true
    order.paidAt = Date.now()
    order.paymentResult = {
      id: req.body.id,
      status: req.body.status,
      update_time: req.body.update_time,
      email_address: req.body.payer.email_address,
    }

    const updatedOrder = await order.save()

    // Add points to user (1 point per 1 yuan)
    const user = await User.findById(order.user)
    if (user) {
      user.points += order.totalPrice
      await user.save()
    }

    res.json(updatedOrder)
  } else {
    res.status(404)
    throw new Error('Order not found')
  }
})

// @desc    Update order to delivered
// @route   PUT /api/orders/:id/deliver
// @access  Private/Admin
const updateOrderToDelivered = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id)

  if (order) {
    order.isDelivered = true
    order.deliveredAt = Date.now()

    const updatedOrder = await order.save()
    res.json(updatedOrder)
  } else {
    res.status(404)
    throw new Error('Order not found')
  }
})

// @desc    Get logged in user orders
// @route   GET /api/orders/myorders
// @access  Private
const getMyOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.user._id })
  res.json(orders)
})

// @desc    Request order return
// @route   PUT /api/orders/:id/return
// @access  Private
const requestOrderReturn = asyncHandler(async (req, res) => {
  const { reason } = req.body
  const order = await Order.findById(req.params.id)

  if (!order) {
    res.status(404)
    throw new Error('Order not found')
  }

  if (!order.isDelivered) {
    res.status(400)
    throw new Error('Order not delivered yet')
  }

  const deliveredTime = new Date(order.deliveredAt)
  const now = new Date()
  const hoursDiff = Math.abs(now - deliveredTime) / 36e5

  if (hoursDiff > 24) {
    res.status(400)
    throw new Error('Return request must be made within 24 hours after delivery')
  }

  order.returnRequest = {
    isRequested: true,
    reason,
    status: 'pending',
    requestedAt: Date.now()
  }

  const updatedOrder = await order.save()
  res.json(updatedOrder)
})

// @desc    Update return status
// @route   PUT /api/orders/:id/return/status
// @access  Private/Admin
const updateReturnStatus = asyncHandler(async (req, res) => {
  const { status, rejectReason } = req.body
  const order = await Order.findById(req.params.id)

  if (!order) {
    res.status(404)
    throw new Error('Order not found')
  }

  if (!order.returnRequest || !order.returnRequest.isRequested) {
    res.status(400)
    throw new Error('No return request for this order')
  }

  order.returnRequest.status = status
  if (status === 'rejected') {
    order.returnRequest.rejectReason = rejectReason
  } else if (status === 'approved') {
    // Refund logic would go here
    order.isRefunded = true
    order.refundedAt = Date.now()
  }

  const updatedOrder = await order.save()
  res.json(updatedOrder)
})

// @desc    Get all orders
// @route   GET /api/orders
// @access  Private/Admin
const getOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({}).populate('user', 'id name')
  res.json(orders)
})

export {
  addOrderItems,
  getOrderById,
  updateOrderToPaid,
  updateOrderToDelivered,
  getMyOrders,
  requestOrderReturn,
  updateReturnStatus,
  getOrders,
}
