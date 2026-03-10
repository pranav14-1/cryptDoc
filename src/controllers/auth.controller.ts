import { Request, Response } from 'express';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { query } from '../db';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'default_secret';

export const register = async (req: Request, res: Response): Promise<void> => {
    try {
        const { username, password, role_name = 'Guest' } = req.body;

        if (!username || !password) {
            res.status(400).json({ error: 'Username and password are required' });
            return;
        }

        // Hash password with Argon2
        const passwordHash = await argon2.hash(password);

        // Get role ID
        const roleResult = await query('SELECT id FROM roles WHERE name = $1', [role_name]);
        if (roleResult.rows.length === 0) {
            res.status(400).json({ error: 'Invalid role' });
            return;
        }
        const roleId = roleResult.rows[0].id;

        // Insert user
        const result = await query(
            'INSERT INTO users (username, password_hash, role_id) VALUES ($1, $2, $3) RETURNING id, username, role_id',
            [username, passwordHash, roleId]
        );

        res.status(201).json({ message: 'User registered successfully', user: result.rows[0] });
    } catch (error: any) {
        if (error.code === '23505') { // Postgres unique constraint violation
            res.status(409).json({ error: 'Username already exists' });
        } else {
            console.error('Registration Error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
};

export const login = async (req: Request, res: Response): Promise<void> => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            res.status(400).json({ error: 'Username and password are required' });
            return;
        }

        // Fetch user
        const result = await query(
            'SELECT u.id, u.username, u.password_hash, r.name as role FROM users u JOIN roles r ON u.role_id = r.id WHERE u.username = $1',
            [username]
        );

        if (result.rows.length === 0) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }

        const user = result.rows[0];

        // Verify password
        const valid = await argon2.verify(user.password_hash, password);
        if (!valid) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }

        // Generate JWT
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '1d' }
        );

        res.status(200).json({ token, role: user.role });
    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
