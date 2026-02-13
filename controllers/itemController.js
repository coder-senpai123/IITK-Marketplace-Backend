const Item = require('../models/Item');
const { cloudinary } = require('../config/cloudinary');

// @desc    Create a new listing
// @route   POST /api/items
// @access  Private
exports.createItem = async (req, res) => {
  try {
    let imageUrls = [];
    if (req.files && req.files.length > 0) {
      imageUrls = req.files.map(file => file.path);
    }

    const item = await Item.create({
      ...req.body,
      seller: req.user.id,
      images: imageUrls,
      status: 'active'
    });

    res.status(201).json({ success: true, data: item });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// @desc    Get all active listings (for buyers browsing)
// @route   GET /api/items
// @access  Private
exports.getItems = async (req, res) => {
  try {
    const items = await Item.find({ status: 'active' })
      .sort({ createdAt: -1 })
      .populate('seller', 'name email role');

    res.status(200).json({
      success: true,
      count: items.length,
      data: items
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// @desc    Get logged-in seller's own items
// @route   GET /api/items/mine
// @access  Private
exports.getMyItems = async (req, res) => {
  try {
    const items = await Item.find({
      seller: req.user.id,
      status: { $ne: 'deleted' }
    })
      .sort({ createdAt: -1 })
      .populate('seller', 'name email role');

    res.status(200).json({
      success: true,
      count: items.length,
      data: items
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// @desc    Get single listing
// @route   GET /api/items/:id
// @access  Private
exports.getItemById = async (req, res) => {
  try {
    const item = await Item.findById(req.params.id).populate('seller', 'name email role');

    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    res.status(200).json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// @desc    Update listing
// @route   PUT /api/items/:id
// @access  Private
exports.updateItem = async (req, res) => {
  try {
    let item = await Item.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    if (item.seller.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this item' });
    }

    item = await Item.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    res.status(200).json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// @desc    Mark item as sold
// @route   PATCH /api/items/:id/sold
// @access  Private (owner only)
exports.markAsSold = async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    if (item.seller.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (item.status === 'sold') {
      return res.status(400).json({ success: false, message: 'Item is already sold' });
    }

    item.status = 'sold';
    await item.save();

    res.status(200).json({ success: true, data: item, message: 'Item marked as sold' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// @desc    Soft-delete item
// @route   DELETE /api/items/:id
// @access  Private (owner only)
exports.deleteItem = async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    if (item.seller.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this item' });
    }

    item.status = 'deleted';
    await item.save();

    res.status(200).json({ success: true, message: 'Item removed' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};