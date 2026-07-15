import { verifyWebviewToken } from '@/lib/auth';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const worker = searchParams.get('worker') || '';
        const token = searchParams.get('token') || '';
        const purpose = searchParams.get('purpose') || undefined;

        const isValid = verifyWebviewToken(worker, token, { purpose });
        return Response.json({ valid: isValid });
    } catch (e) {
        return Response.json({ valid: false, error: "Validation error" }, { status: 500 });
    }
}
