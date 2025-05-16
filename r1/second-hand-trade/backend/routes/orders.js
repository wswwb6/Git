import express from 'express'
const router = express.Router()
import {
  addOrderItems,
  getOrderById,
  updateOrderToPaid,
  updateOrderToDelivered,
  getMyOrders,
  requestOrderReturn,
  updateReturnStatus,
  getOrders,
} from '../controllers/orderController.js'
import { protect, admin } from '../middleware/authMiddleware.js'

router.route('/')
  .post(protect, addOrderItems)
  .get(protect, admin, getOrders)

router.route('/myorders').get(protect, getMyOrders)
router.route('/:id').get(protect, getOrderById)
router.route('/:id/pay').put(protect, updateOrderToPaid)
router.route('/:id/deliver').put(protect, admin, updateOrderToDelivered)
router.route('/:id/return').put(protect, requestOrderReturn)
router.route('/:id/return/status').put(protect, admin, updateReturnStatus)

export default router
