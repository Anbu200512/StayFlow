import { Router } from 'express';
import { authLimiter } from '../middleware/rateLimit.js';
import { authenticate } from '../middleware/auth.js';
import { authSchemas } from '../services/authService.js';
import { validateRequest } from '../utils/validateRequest.js';
import { forgotPasswordController, loginController, logoutController, refreshController, resetPasswordController } from '../controllers/authController.js';

export const authRouter = Router();
authRouter.post('/login', authLimiter, validateRequest(authSchemas.login), loginController);
authRouter.post('/refresh', authLimiter, validateRequest(authSchemas.refresh), refreshController);
authRouter.post('/logout', logoutController);
authRouter.post('/forgot-password', authLimiter, validateRequest(authSchemas.forgot), forgotPasswordController);
authRouter.post('/reset-password', authLimiter, validateRequest(authSchemas.reset), resetPasswordController);
authRouter.get('/me', authenticate, async (request, response) => {
  response.json({ success: true, data: { user: request.user } });
});
