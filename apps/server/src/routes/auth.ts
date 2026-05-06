import { Router, Request, Response } from 'express';
import { countUsers, createUser, getUserByUsername } from '../db/queries';
import { hashPassword, verifyPassword } from '../auth/password';
import { signToken } from '../auth/jwt';
import type { RegisterDto, LoginDto } from '@gemini-relay/shared';

const router = Router();

router.get('/status', (_req: Request, res: Response) => {
  const userCount = countUsers();
  res.json({ registrationOpen: userCount === 0 });
});

router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body as RegisterDto;
    if (!username || !password) {
      res.status(400).json({ error: 'username and password are required' });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: 'password must be at least 8 characters' });
      return;
    }
    const userCount = countUsers();
    if (userCount > 0) {
      res.status(403).json({ error: 'Registration is closed. Only one user is allowed.' });
      return;
    }
    const existing = getUserByUsername(username);
    if (existing) {
      res.status(409).json({ error: 'Username already taken' });
      return;
    }
    const passwordHash = await hashPassword(password);
    const user = createUser(username, passwordHash);
    const token = signToken({ userId: user.id, username: user.username });
    res.status(201).json({ token, user: { id: user.id, username: user.username } });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body as LoginDto;
    if (!username || !password) {
      res.status(400).json({ error: 'username and password are required' });
      return;
    }
    const user = getUserByUsername(username);
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    const token = signToken({ userId: user.id, username: user.username });
    res.json({ token, user: { id: user.id, username: user.username } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
