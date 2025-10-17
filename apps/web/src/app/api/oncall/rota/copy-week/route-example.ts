/**
 * Example API route using the withScope wrapper
 * This shows how to implement the copy-week endpoint with proper scope enforcement
 */

import { NextRequest, NextResponse } from "next/server";
import { withScope } from "@/lib/route-wrapper";

// Example handler function
async function handleCopyWeek(
  req: NextRequest, 
  { orgId, keyId, bypass }: { orgId: string; keyId?: string; bypass: boolean }
): Promise<NextResponse> {
  try {
    // Parse request body
    const body = await req.json();
    const { from, weeks } = body;
    
    // Validate input
    if (!from || !weeks) {
      return NextResponse.json(
        { error: { code: 'invalid_input', message: 'Missing required fields: from, weeks' } },
        { status: 400 }
      );
    }
    
    // Your business logic here
    // This is where you'd implement the actual copy-week functionality
    const result = {
      success: true,
      message: `Copied ${weeks} weeks starting from ${from}`,
      orgId,
      keyId,
      bypass,
      timestamp: new Date().toISOString(),
    };
    
    // Log the operation (keyId is safe to log, raw key is not)
    console.info('[copy-week] Operation completed', { 
      orgId, 
      keyId, 
      bypass, 
      from, 
      weeks 
    });
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('[copy-week] Error:', error);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to copy week' } },
      { status: 500 }
    );
  }
}

// Export the route with scope enforcement
export const POST = withScope("copy.week", handleCopyWeek);

/**
 * Alternative implementation with query parameters instead of body
 */
async function handleCopyWeekQuery(
  req: NextRequest, 
  { orgId, keyId, bypass }: { orgId: string; keyId?: string; bypass: boolean }
): Promise<NextResponse> {
  try {
    // Parse query parameters
    const url = new URL(req.url);
    const from = url.searchParams.get('from');
    const weeks = url.searchParams.get('weeks');
    
    // Validate input
    if (!from || !weeks) {
      return NextResponse.json(
        { error: { code: 'invalid_input', message: 'Missing required query parameters: from, weeks' } },
        { status: 400 }
      );
    }
    
    const weeksNum = parseInt(weeks);
    if (isNaN(weeksNum) || weeksNum <= 0) {
      return NextResponse.json(
        { error: { code: 'invalid_input', message: 'weeks must be a positive integer' } },
        { status: 400 }
      );
    }
    
    // Your business logic here
    const result = {
      success: true,
      message: `Copied ${weeksNum} weeks starting from ${from}`,
      orgId,
      keyId,
      bypass,
      timestamp: new Date().toISOString(),
    };
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('[copy-week-query] Error:', error);
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to copy week' } },
      { status: 500 }
    );
  }
}

// Export alternative implementation
// export const POST = withScope("copy.week", handleCopyWeekQuery);

/**
 * Example with multiple scopes (any one of them)
 */
async function handleFlexibleOperation(
  req: NextRequest, 
  { orgId, keyId, bypass }: { orgId: string; keyId?: string; bypass: boolean }
): Promise<NextResponse> {
  // This handler can be called with either "rota.write" or "copy.week" scope
  return NextResponse.json({
    success: true,
    message: 'Flexible operation completed',
    orgId,
    keyId,
    bypass,
  });
}

// Uncomment to use multiple scopes
// export const POST = withAnyScope(["rota.write", "copy.week"], handleFlexibleOperation);
