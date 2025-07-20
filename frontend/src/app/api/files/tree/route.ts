import { NextResponse } from 'next/server';
import { getFileTreeForUser } from '@/lib/db';

export interface FileNode {
  id: number;
  parent_id: number | null;
  name: string;
  is_dir: boolean;
  content: string | null;
  created_at: string;
  updated_at: string;
  children?: FileNode[];
}

export async function GET(request: Request) {
  try {
    // Get the userId from the query parameters
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Get the file tree directly from the database
    const fileTree = await getFileTreeForUser(userId);
    return NextResponse.json(fileTree);

  } catch (error) {
    console.error('Error in /api/files/tree:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Export other HTTP methods with 405 Method Not Allowed
const METHOD_NOT_ALLOWED = new NextResponse('Method Not Allowed', { status: 405 });

export async function POST() { return METHOD_NOT_ALLOWED; }
export async function PUT() { return METHOD_NOT_ALLOWED; }
export async function DELETE() { return METHOD_NOT_ALLOWED; }
export async function PATCH() { return METHOD_NOT_ALLOWED; }