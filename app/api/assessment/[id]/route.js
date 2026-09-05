import { NextResponse } from 'next/server';
import { getAssessmentsCollection } from '@/lib/mongodb';

export async function GET(_req, { params }) {
  try {
    const col = await getAssessmentsCollection();
    const assessment = await col.findOne({ _id: params.id });
    if (!assessment) {
      return NextResponse.json({ error: 'Assessment not found.' }, { status: 404 });
    }
    return NextResponse.json(assessment);
  } catch (err) {
    console.error('[api/assessment/:id] error:', err);
    return NextResponse.json({ error: err.message || 'Lookup failed.' }, { status: 500 });
  }
}
