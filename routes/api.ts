import { Router } from 'express';
import bcrypt from 'bcrypt';
import { pool, queryAsUser } from './server'; // Wait, server does not export pool.

const router = Router();
export default router;
