import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import User from '@/models/User';

export async function POST(req: NextRequest) {
    try {
        await dbConnect();
        const { userId, targetUserId, action } = await req.json();

        if (!userId || !targetUserId || !['block', 'unblock'].includes(action)) {
            return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
        }

        const user = await User.findById(userId);
        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Initialize blockedUsers if it doesn't exist
        if (!user.blockedUsers) {
            user.blockedUsers = [];
        }

        if (action === 'block') {
            if (!user.blockedUsers.includes(targetUserId)) {
                user.blockedUsers.push(targetUserId);
            }
        } else {
            user.blockedUsers = user.blockedUsers.filter(id => id !== targetUserId);
        }

        await user.save();
        return NextResponse.json({ success: true, blockedUsers: user.blockedUsers });
    } catch (error) {
        console.error('Block error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
