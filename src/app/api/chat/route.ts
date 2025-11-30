import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import dbConnect from '@/lib/db';
import Message from '@/models/Message';
import User from '@/models/User';
import { validateContent } from '@/lib/moderation';

export async function GET(req: NextRequest) {
    try {
        await dbConnect();
        const { searchParams } = new URL(req.url);
        const type = searchParams.get('type');
        const branch = searchParams.get('branch');
        const year = searchParams.get('year');
        const userId = searchParams.get('userId');

        const recipientId = searchParams.get('recipientId');

        if (!type) {
            return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
        }

        // Update user's last active status if userId is provided
        if (userId) {
            await User.findByIdAndUpdate(userId, { lastActive: new Date() });
        }

        // Get online users count (active in last 5 minutes)
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const onlineCount = await User.countDocuments({ lastActive: { $gte: fiveMinutesAgo } });
        const totalUsers = await User.countDocuments({});

        if (type === 'conversations') {
            if (!userId) return NextResponse.json({ error: 'User ID required' }, { status: 400 });
            
            // Find all DM messages involving this user to get unique contacts
            // Optimization: Use aggregation to get unique other parties
            const conversations = await Message.aggregate([
                {
                    $match: {
                        type: 'dm',
                        $or: [{ senderId: userId }, { recipientId: userId }]
                    }
                },
                {
                    $sort: { createdAt: -1 }
                },
                {
                    $group: {
                        _id: {
                            $cond: [{ $eq: ["$senderId", userId] }, "$recipientId", "$senderId"]
                        },
                        lastMessage: { $first: "$$ROOT" }
                    }
                },
                {
                    $lookup: {
                        from: "users",
                        localField: "_id",
                        foreignField: "_id", // Assuming _id is stored as string in Message but ObjectId in User. If Message stores string, we might need conversion. 
                        // Actually Message schema defines senderId as String. User _id is ObjectId. 
                        // Mongoose/Mongo usually handles this if we cast, but in aggregation it's tricky.
                        // Let's try simple find first to avoid type mismatch issues if IDs are strings vs ObjectIds.
                        as: "userDetails"
                    }
                }
            ]);
            
            // Since aggregation with lookup on String vs ObjectId is painful without $toObjectId (which requires Mongo 4.0+), 
            // and we are using Mongoose where _id is ObjectId but we store strings in Message...
            // Let's do it in application layer for safety and simplicity.
            
            const distinctUserIds = await Message.find({
                type: 'dm',
                $or: [{ senderId: userId }, { recipientId: userId }]
            }).distinct('senderId');
            
            const distinctRecipientIds = await Message.find({
                type: 'dm',
                $or: [{ senderId: userId }, { recipientId: userId }]
            }).distinct('recipientId');
            
            const normalizedIds = [...distinctUserIds, ...distinctRecipientIds]
                .map(id => (typeof id === 'string' ? id : (id as Types.ObjectId | undefined)?.toString()))
                .filter((id): id is string => Boolean(id && id !== userId));

            const uniqueIds = Array.from(new Set(normalizedIds));
            
            const users = await User.find({ _id: { $in: uniqueIds } })
                .select('name _id firebaseUid photoURL');

            return NextResponse.json({ conversations: users }, { status: 200 });
        }

        let query: any = { type };
        if (type === 'branch') {
            if (!branch) return NextResponse.json({ error: 'Branch required' }, { status: 400 });
            query.branch = branch;
        } else if (type === 'year') {
            if (!year) return NextResponse.json({ error: 'Year required' }, { status: 400 });
            query.year = Number(year);
        } else if (type === 'dm') {
            if (!userId || !recipientId) return NextResponse.json({ error: 'User ID and Recipient ID required for DM' }, { status: 400 });
            query = {
                type: 'dm',
                $or: [
                    { senderId: userId, recipientId: recipientId },
                    { senderId: recipientId, recipientId: userId }
                ]
            };
        }

        const totalMessages = await Message.countDocuments(query);

        const messages = await Message.find(query)
            .sort({ createdAt: 1 }) // Oldest first
            .limit(100); // Limit to last 100 messages

        return NextResponse.json({ messages, onlineCount, totalUsers, totalMessages }, { status: 200 });
    } catch (error) {
        console.error('Error fetching messages:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        await dbConnect();
        const body = await req.json();
        const { content, senderId, type, branch, year, replyTo, sticker, recipientId } = body;

        if ((!content && !sticker) || !senderId || !type) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Verify sender exists and get name
        const sender = await User.findById(senderId);
        if (!sender) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Check for blocks in DM
        if (type === 'dm' && recipientId) {
            const recipient = await User.findById(recipientId);
            if (recipient) {
                // Check if recipient has blocked sender
                if (recipient.blockedUsers?.includes(senderId)) {
                    return NextResponse.json({ error: 'Message not sent: You have been blocked by this user.' }, { status: 403 });
                }
                // Check if sender has blocked recipient
                if (sender.blockedUsers?.includes(recipientId)) {
                    return NextResponse.json({ error: 'Message not sent: You have blocked this user. Unblock them to send messages.' }, { status: 403 });
                }
            }
        }

        // Moderation check
        if (content) {
            try {
                await validateContent(content, 'message');
            } catch (modError: any) {
                return NextResponse.json({ error: modError.message }, { status: 400 });
            }
        }

        // Verify branch/year match
        if (type === 'branch') {
            if (!branch) return NextResponse.json({ error: 'Branch is required' }, { status: 400 });
            // Allow if sender.branch is missing (legacy users) or matches
            if (sender.branch && sender.branch !== branch) {
                return NextResponse.json({ error: 'Wrong branch' }, { status: 403 });
            }
        }
        if (type === 'year') {
            if (!year) return NextResponse.json({ error: 'Year is required' }, { status: 400 });
            
            // Allow if sender.year is missing (legacy users) or matches
            if (sender.year && Number(sender.year) !== Number(year)) {
                return NextResponse.json({ error: `Wrong year. You are in Year ${sender.year}, but trying to post to Year ${year}` }, { status: 403 });
            }
        } else if (type === 'dm') {
            if (!recipientId) return NextResponse.json({ error: 'Recipient ID is required for DM' }, { status: 400 });
        }

        const messageData: any = {
            content: content || '',
            senderId,
            senderName: sender.name,
            type,
            branch: type === 'branch' ? branch : undefined,
            year: type === 'year' ? year : undefined,
            recipientId: type === 'dm' ? recipientId : undefined,
            sticker
        };

        if (replyTo) {
            messageData.replyTo = replyTo;
        }

        const message = await Message.create(messageData);

        return NextResponse.json({ message }, { status: 201 });
    } catch (error: any) {
        console.error('Error creating message:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
