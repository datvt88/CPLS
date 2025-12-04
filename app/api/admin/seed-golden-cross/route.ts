import { NextRequest, NextResponse } from 'next/server'
import { getDatabase, ref, set } from 'firebase/database'
import { database } from '@/lib/firebaseClient'

/**
 * Add demo Golden Cross data to Firebase for testing
 */
export async function POST(request: NextRequest) {
  try {
    console.log('📝 Adding demo Golden Cross data to Firebase...')

    // Demo data - realistic Vietnamese stocks with Golden Cross signals
    const demoData = {
      VNM: {
        ticker: 'VNM',
        name: 'Vinamilk',
        crossDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
        ma50: 72500,
        ma200: 70000,
        price: 73000,
        volume: 1500000,
        marketCap: 120000000000000,
        sector: 'Hàng tiêu dùng',
        lastUpdated: new Date().toISOString(),
      },
      HPG: {
        ticker: 'HPG',
        name: 'Hoa Phat Group',
        crossDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
        ma50: 28500,
        ma200: 27000,
        price: 29000,
        volume: 8000000,
        marketCap: 80000000000000,
        sector: 'Nguyên vật liệu',
        lastUpdated: new Date().toISOString(),
      },
      VCB: {
        ticker: 'VCB',
        name: 'Vietcombank',
        crossDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
        ma50: 95000,
        ma200: 92000,
        price: 96500,
        volume: 3000000,
        marketCap: 200000000000000,
        sector: 'Ngân hàng',
        lastUpdated: new Date().toISOString(),
      },
      VHM: {
        ticker: 'VHM',
        name: 'Vinhomes',
        crossDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
        ma50: 42000,
        ma200: 40000,
        price: 42500,
        volume: 5000000,
        marketCap: 150000000000000,
        sector: 'Bất động sản',
        lastUpdated: new Date().toISOString(),
      },
      FPT: {
        ticker: 'FPT',
        name: 'FPT Corporation',
        crossDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
        ma50: 125000,
        ma200: 120000,
        price: 126000,
        volume: 2000000,
        marketCap: 90000000000000,
        sector: 'Công nghệ',
        lastUpdated: new Date().toISOString(),
      },
      VIC: {
        ticker: 'VIC',
        name: 'Vingroup',
        crossDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago
        ma50: 48000,
        ma200: 46000,
        price: 48500,
        volume: 4500000,
        marketCap: 180000000000000,
        sector: 'Đa ngành',
        lastUpdated: new Date().toISOString(),
      },
      MWG: {
        ticker: 'MWG',
        name: 'Mobile World',
        crossDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), // 4 days ago
        ma50: 58000,
        ma200: 56000,
        price: 58500,
        volume: 1800000,
        marketCap: 45000000000000,
        sector: 'Bán lẻ',
        lastUpdated: new Date().toISOString(),
      },
      GAS: {
        ticker: 'GAS',
        name: 'PetroVietnam Gas',
        crossDate: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(), // 6 days ago
        ma50: 105000,
        ma200: 102000,
        price: 106000,
        volume: 1200000,
        marketCap: 110000000000000,
        sector: 'Năng lượng',
        lastUpdated: new Date().toISOString(),
      },
      TCB: {
        ticker: 'TCB',
        name: 'Techcombank',
        crossDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(), // 8 days ago
        ma50: 52000,
        ma200: 50000,
        price: 52500,
        volume: 6000000,
        marketCap: 140000000000000,
        sector: 'Ngân hàng',
        lastUpdated: new Date().toISOString(),
      },
      VPB: {
        ticker: 'VPB',
        name: 'VPBank',
        crossDate: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(), // 9 days ago
        ma50: 22000,
        ma200: 21000,
        price: 22300,
        volume: 7000000,
        marketCap: 70000000000000,
        sector: 'Ngân hàng',
        lastUpdated: new Date().toISOString(),
      },
    }

    // Write to Firebase Realtime Database
    const goldenCrossRef = ref(database, 'goldenCross')
    await set(goldenCrossRef, demoData)

    console.log('✅ Demo data added successfully!')

    return NextResponse.json({
      success: true,
      message: 'Demo Golden Cross data added successfully! 🎉',
      count: Object.keys(demoData).length,
      stocks: Object.keys(demoData),
    })
  } catch (error) {
    console.error('Error adding demo data:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to add demo data',
      },
      { status: 500 }
    )
  }
}

/**
 * Clear all Golden Cross data from Firebase
 */
export async function DELETE(request: NextRequest) {
  try {
    console.log('🗑️ Clearing Golden Cross data from Firebase...')

    const goldenCrossRef = ref(database, 'goldenCross')
    await set(goldenCrossRef, null)

    console.log('✅ Data cleared successfully!')

    return NextResponse.json({
      success: true,
      message: 'Golden Cross data cleared successfully',
    })
  } catch (error) {
    console.error('Error clearing data:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to clear data',
      },
      { status: 500 }
    )
  }
}

/**
 * Get current Golden Cross data from Firebase (for verification)
 */
export async function GET(request: NextRequest) {
  try {
    const { get } = await import('firebase/database')
    const goldenCrossRef = ref(database, 'goldenCross')
    const snapshot = await get(goldenCrossRef)

    if (!snapshot.exists()) {
      return NextResponse.json({
        exists: false,
        message: 'No Golden Cross data found in Firebase',
        data: null,
      })
    }

    const data = snapshot.val()
    const stocks = Object.keys(data)

    return NextResponse.json({
      exists: true,
      count: stocks.length,
      stocks,
      data,
    })
  } catch (error) {
    console.error('Error reading data:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to read data',
      },
      { status: 500 }
    )
  }
}
