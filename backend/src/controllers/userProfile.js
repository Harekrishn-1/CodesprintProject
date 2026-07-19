const cloudinary = require('cloudinary').v2;
const User = require('../models/user');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// PUT /user/updateProfile  body: { firstName, lastName, age }
const updateProfile = async (req, res) => {
  try {
    const userId = req.result._id;
    const { firstName, lastName, age } = req.body;

    if (!firstName || firstName.trim().length < 3) {
      return res.status(400).json({ message: 'First name must be at least 3 characters' });
    }

    const updated = await User.findByIdAndUpdate(
      userId,
      {
        firstName: firstName.trim(),
        lastName: (lastName || '').trim(),
        ...(age ? { age: Number(age) } : {})
      },
      { new: true, runValidators: true }
    ).select('firstName lastName emailId age role profileImageUrl');

    res.status(200).json({ message: 'Profile updated', user: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Profile update failed' });
  }
};

// GET /user/profileImage/signature — Cloudinary signed upload (image)
const generateImageUploadSignature = async (req, res) => {
  try {
    const userId = req.result._id;
    const timestamp = Math.round(new Date().getTime() / 1000);
    const publicId = `profile-images/${userId}_${timestamp}`;

    const uploadParams = { timestamp, public_id: publicId };

    const signature = cloudinary.utils.api_sign_request(
      uploadParams,
      process.env.CLOUDINARY_API_SECRET
    );

    res.json({
      signature,
      timestamp,
      public_id: publicId,
      api_key: process.env.CLOUDINARY_API_KEY,
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      upload_url: `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to generate upload credentials' });
  }
};

// POST /user/profileImage/save  body: { secureUrl, publicId }
const saveProfileImage = async (req, res) => {
  try {
    const userId = req.result._id;
    const { secureUrl, publicId } = req.body;

    if (!secureUrl) return res.status(400).json({ message: 'secureUrl is required' });

    // purani photo Cloudinary se hata do (storage saaf rahe)
    const user = await User.findById(userId);
    if (user.profileImagePublicId) {
      try {
        await cloudinary.uploader.destroy(user.profileImagePublicId, { resource_type: 'image' });
      } catch (e) { /* purani delete na ho paye to bhi nayi save hogi */ }
    }

    user.profileImageUrl = secureUrl;
    user.profileImagePublicId = publicId || null;
    await user.save();

    res.status(200).json({ message: 'Profile photo updated', profileImageUrl: secureUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to save profile photo' });
  }
};

module.exports = { updateProfile, generateImageUploadSignature, saveProfileImage };