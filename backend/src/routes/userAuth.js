const express = require('express');

const authRouter =  express.Router();
const {register, login,logout, adminRegister,deleteProfile} = require('../controllers/userAuthent')
const userMiddleware = require("../middleware/userMiddleware");
const adminMiddleware = require('../middleware/adminMiddleware');
const { updateProfile, generateImageUploadSignature, saveProfileImage } = require('../controllers/userProfile');
// Register
authRouter.post('/register', register);
authRouter.post('/login', login);
authRouter.post('/logout', userMiddleware, logout);
authRouter.post('/admin/register', adminMiddleware ,adminRegister);
authRouter.delete('/deleteProfile',userMiddleware,deleteProfile);
authRouter.get('/check',userMiddleware,(req,res)=>{

    const reply = {
        firstName: req.result.firstName,
        lastName: req.result.lastName,
        emailId: req.result.emailId,
        _id: req.result._id,
        role: req.result.role,
        age: req.result.age,
        profileImageUrl: req.result.profileImageUrl,
    }

    res.status(200).json({
        user:reply,
        message:"Valid User"
    });
})
// authRouter.get('/getProfile',getProfile);
authRouter.put('/updateProfile', userMiddleware, updateProfile);
authRouter.get('/profileImage/signature', userMiddleware, generateImageUploadSignature);
authRouter.post('/profileImage/save', userMiddleware, saveProfileImage);

module.exports = authRouter;

// login
// logout
// GetProfile

