const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: [true, 'Please add a title'],
    trim: true,
    maxlength: [100, 'Title cannot be more than 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Please add a description'],
    maxlength: [1000, 'Description cannot be more than 1000 characters']
  },
  price: {
    type: Number,
    required: [true, 'Please add a price']
  },
  category: {
    type: String,
    required: [true, 'Please select a category'],
    enum: ['Electronics', 'Books', 'Furniture', 'Cycles', 'Clothing', 'Other']
  },
  condition: {
    type: String,
    required: [true, 'Please select condition'],
    enum: ['New', 'Like New', 'Good', 'Fair', 'Poor']
  },
  location: {
    type: String,
    required: [true, 'Please specify hostel or campus location']
  },
  images: {
    type: [String],
    default: []
  },
  status: {
    type: String,
    enum: ['active', 'sold', 'deleted'],
    default: 'active'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

itemSchema.index({ title: 'text', description: 'text' });

module.exports = mongoose.model('Item', itemSchema);