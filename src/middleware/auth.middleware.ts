import { Request, Response, NextFunction } from 'express';

export interface AuthRequest extends Request {
    user?: {
        id: string;
        username: string;
        role: string;
    };
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction): void => {
    // DEMO MODE: Read mock user context from headers sent by index.html
    const mockId = req.headers['x-mock-user-id'] as string;
    const mockUsername = req.headers['x-mock-username'] as string;
    const mockRole = req.headers['x-mock-role'] as string;

    if (!mockId || !mockUsername || !mockRole) {
        res.status(401).json({ error: 'Demo mode requires x-mock-* headers' });
        return;
    }

    req.user = {
        id: mockId,
        username: mockUsername,
        role: mockRole
    };

    next();
};

export const requireRole = (allowedRoles: string[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction): void => {
        // In demo mode, we allow the request if the mock user is set
        if (!req.user) {
            res.status(403).json({ error: 'Forbidden: No identity' });
            return;
        }

        // Specific check for demo: If trying to download and not in allowedRoles, 
        // the controller will handle streaming the encrypted version instead of a 403.
        // So we allow it through here.
        next();
    };
};
