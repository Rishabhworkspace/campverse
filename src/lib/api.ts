export const API_SECRET = process.env.NEXT_PUBLIC_API_SECRET;

export const getAuthHeaders = () => {
    return {
        'Authorization': `Bearer ${API_SECRET}`,
        'Content-Type': 'application/json',
    };
};
