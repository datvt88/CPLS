'use client'

import { useState, useEffect } from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  Stack,
  LinearProgress,
} from '@mui/material'
import {
  TrendingUp,
  Visibility,
  ShoppingCart,
  Info,
  Refresh,
  CheckCircle,
  Warning,
} from '@mui/icons-material'
import Link from 'next/link'

interface GoldenCrossStock {
  ticker: string
  name?: string
  price?: number
  crossDate?: string
  ma50?: number
  ma200?: number
  signal: 'MUA' | 'THEO DÕI'
  confidence: number
  shortTermSignal: string
  longTermSignal: string
  targetPrice?: string
  stopLoss?: string
  summary: string
  risks: string[]
  opportunities: string[]
  technicalScore: number
  fundamentalScore: number
  lastUpdated?: string
}

interface GoldenCrossWidgetProps {
  limit?: number
  autoRefresh?: boolean
  refreshInterval?: number // in milliseconds
}

export default function GoldenCrossWidget({
  limit = 10,
  autoRefresh = false,
  refreshInterval = 300000, // 5 minutes
}: GoldenCrossWidgetProps) {
  const [stocks, setStocks] = useState<GoldenCrossStock[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedStock, setSelectedStock] = useState<GoldenCrossStock | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  const fetchGoldenCrossStocks = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/signals/golden-cross?limit=${limit}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch Golden Cross stocks')
      }

      setStocks(data.stocks || [])
      setLastUpdate(new Date())
    } catch (err) {
      console.error('Error fetching Golden Cross stocks:', err)
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchGoldenCrossStocks()

    // Auto-refresh if enabled
    if (autoRefresh) {
      const interval = setInterval(fetchGoldenCrossStocks, refreshInterval)
      return () => clearInterval(interval)
    }
  }, [limit, autoRefresh, refreshInterval])

  const handleFollowStock = (ticker: string) => {
    // TODO: Implement follow functionality (add to watchlist)
    console.log('Following stock:', ticker)
    alert(`Đã thêm ${ticker} vào danh sách theo dõi!`)
  }

  const handleBuyStock = (ticker: string) => {
    // TODO: Navigate to trading interface or open buy dialog
    console.log('Buying stock:', ticker)
    alert(`Chuyển đến giao dịch cho ${ticker}`)
  }

  const getSignalColor = (signal: string): 'success' | 'info' | 'warning' => {
    if (signal === 'MUA') return 'success'
    if (signal === 'THEO DÕI') return 'info'
    return 'warning'
  }

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 80) return '#4caf50'
    if (confidence >= 60) return '#2196f3'
    if (confidence >= 40) return '#ff9800'
    return '#f44336'
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    const today = new Date()
    const diffTime = Math.abs(today.getTime() - date.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Hôm nay'
    if (diffDays === 1) return 'Hôm qua'
    if (diffDays <= 7) return `${diffDays} ngày trước`
    if (diffDays <= 30) return `${Math.floor(diffDays / 7)} tuần trước`
    return date.toLocaleDateString('vi-VN')
  }

  if (loading && stocks.length === 0) {
    return (
      <Card>
        <CardContent>
          <Box display="flex" flexDirection="column" alignItems="center" py={4}>
            <CircularProgress size={48} />
            <Typography variant="body2" color="text.secondary" mt={2}>
              Đang phân tích cổ phiếu Golden Cross với Gemini AI...
            </Typography>
          </Box>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent>
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
          <Button variant="contained" onClick={fetchGoldenCrossStocks} startIcon={<Refresh />}>
            Thử lại
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Box display="flex" alignItems="center" gap={1}>
            <TrendingUp color="success" />
            <Typography variant="h6" fontWeight="bold">
              Tín hiệu Golden Cross
            </Typography>
            <Chip
              label={`${stocks.length} cổ phiếu`}
              size="small"
              color="primary"
              variant="outlined"
            />
          </Box>
          <Box display="flex" alignItems="center" gap={1}>
            {lastUpdate && (
              <Typography variant="caption" color="text.secondary">
                Cập nhật: {lastUpdate.toLocaleTimeString('vi-VN')}
              </Typography>
            )}
            <IconButton onClick={fetchGoldenCrossStocks} disabled={loading} size="small">
              <Refresh />
            </IconButton>
          </Box>
        </Box>

        {stocks.length === 0 ? (
          <Alert severity="info">
            Chưa có tín hiệu Golden Cross nào. Hệ thống sẽ tự động cập nhật khi có tín hiệu mới.
          </Alert>
        ) : (
          <>
            <Alert severity="info" icon={<Info />} sx={{ mb: 2 }}>
              <Typography variant="body2">
                <strong>Golden Cross</strong> là tín hiệu kỹ thuật mạnh mẽ khi MA50 vượt lên MA200,
                thường báo hiệu xu hướng tăng dài hạn. Dưới đây là các cổ phiếu được Gemini AI đánh
                giá tốt.
              </Typography>
            </Alert>

            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Mã CP</strong></TableCell>
                    <TableCell><strong>Giá</strong></TableCell>
                    <TableCell><strong>Golden Cross</strong></TableCell>
                    <TableCell><strong>Tín hiệu</strong></TableCell>
                    <TableCell align="center"><strong>Độ tin cậy</strong></TableCell>
                    <TableCell align="center"><strong>Điểm kỹ thuật</strong></TableCell>
                    <TableCell><strong>Giá mục tiêu</strong></TableCell>
                    <TableCell align="center"><strong>Hành động</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {stocks.map((stock) => (
                    <TableRow
                      key={stock.ticker}
                      hover
                      sx={{ '&:hover': { backgroundColor: 'action.hover' } }}
                    >
                      <TableCell>
                        <Link
                          href={`/stocks?symbol=${stock.ticker}`}
                          style={{ textDecoration: 'none' }}
                        >
                          <Typography
                            variant="body2"
                            fontWeight="bold"
                            color="primary"
                            sx={{ cursor: 'pointer' }}
                          >
                            {stock.ticker}
                          </Typography>
                        </Link>
                        {stock.name && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            {stock.name}
                          </Typography>
                        )}
                      </TableCell>

                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {stock.price?.toLocaleString('vi-VN')}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          MA50: {stock.ma50?.toFixed(2)}
                        </Typography>
                      </TableCell>

                      <TableCell>
                        <Typography variant="caption" color="text.secondary">
                          {formatDate(stock.crossDate)}
                        </Typography>
                        {stock.ma50 && stock.ma200 && (
                          <Typography variant="caption" color="success.main" display="block">
                            +{(((stock.ma50 - stock.ma200) / stock.ma200) * 100).toFixed(1)}%
                          </Typography>
                        )}
                      </TableCell>

                      <TableCell>
                        <Chip
                          label={stock.signal}
                          size="small"
                          color={getSignalColor(stock.signal)}
                          icon={
                            stock.signal === 'MUA' ? (
                              <CheckCircle fontSize="small" />
                            ) : (
                              <Warning fontSize="small" />
                            )
                          }
                        />
                        <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
                          {stock.shortTermSignal}
                        </Typography>
                      </TableCell>

                      <TableCell align="center">
                        <Box display="flex" flexDirection="column" alignItems="center">
                          <Typography
                            variant="body2"
                            fontWeight="bold"
                            color={getConfidenceColor(stock.confidence)}
                          >
                            {stock.confidence}%
                          </Typography>
                          <LinearProgress
                            variant="determinate"
                            value={stock.confidence}
                            sx={{
                              width: 60,
                              height: 4,
                              borderRadius: 2,
                              mt: 0.5,
                              backgroundColor: 'grey.300',
                              '& .MuiLinearProgress-bar': {
                                backgroundColor: getConfidenceColor(stock.confidence),
                              },
                            }}
                          />
                        </Box>
                      </TableCell>

                      <TableCell align="center">
                        <Typography variant="body2" fontWeight="medium">
                          {stock.technicalScore}/100
                        </Typography>
                      </TableCell>

                      <TableCell>
                        {stock.targetPrice ? (
                          <>
                            <Typography variant="body2" fontWeight="medium" color="success.main">
                              {stock.targetPrice}
                            </Typography>
                            {stock.stopLoss && (
                              <Typography variant="caption" color="error.main" display="block">
                                SL: {stock.stopLoss}
                              </Typography>
                            )}
                          </>
                        ) : (
                          <Typography variant="caption" color="text.secondary">
                            N/A
                          </Typography>
                        )}
                      </TableCell>

                      <TableCell align="center">
                        <Stack direction="row" spacing={0.5} justifyContent="center">
                          <Tooltip title="Theo dõi">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => handleFollowStock(stock.ticker)}
                            >
                              <Visibility fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {stock.signal === 'MUA' && (
                            <Tooltip title="Mua">
                              <IconButton
                                size="small"
                                color="success"
                                onClick={() => handleBuyStock(stock.ticker)}
                              >
                                <ShoppingCart fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          <Tooltip title={stock.summary}>
                            <IconButton
                              size="small"
                              onClick={() => setSelectedStock(stock)}
                            >
                              <Info fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {selectedStock && (
              <Box mt={2} p={2} bgcolor="background.paper" borderRadius={1} border="1px solid" borderColor="divider">
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                  {selectedStock.ticker} - Phân tích chi tiết
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  {selectedStock.summary}
                </Typography>

                {selectedStock.opportunities.length > 0 && (
                  <Box mb={1}>
                    <Typography variant="caption" fontWeight="bold" color="success.main">
                      Cơ hội:
                    </Typography>
                    <ul style={{ margin: '4px 0', paddingLeft: '20px' }}>
                      {selectedStock.opportunities.map((opp, idx) => (
                        <li key={idx}>
                          <Typography variant="caption">{opp}</Typography>
                        </li>
                      ))}
                    </ul>
                  </Box>
                )}

                {selectedStock.risks.length > 0 && (
                  <Box>
                    <Typography variant="caption" fontWeight="bold" color="error.main">
                      Rủi ro:
                    </Typography>
                    <ul style={{ margin: '4px 0', paddingLeft: '20px' }}>
                      {selectedStock.risks.map((risk, idx) => (
                        <li key={idx}>
                          <Typography variant="caption">{risk}</Typography>
                        </li>
                      ))}
                    </ul>
                  </Box>
                )}

                <Button
                  size="small"
                  onClick={() => setSelectedStock(null)}
                  sx={{ mt: 1 }}
                >
                  Đóng
                </Button>
              </Box>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
