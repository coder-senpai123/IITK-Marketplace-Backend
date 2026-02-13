const express = require('express');
const router = express.Router();
const {
  createItem,
  getItems,
  getMyItems,
  getItemById,
  updateItem,
  deleteItem,
  markAsSold
} = require('../controllers/itemController');
const protect = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.use(protect);

router.route('/')
  .get(getItems)
  .post(upload.array('images', 5), createItem);

router.get('/mine', getMyItems);

router.route('/:id')
  .get(getItemById)
  .put(updateItem)
  .delete(deleteItem);

router.patch('/:id/sold', markAsSold);

module.exports = router;