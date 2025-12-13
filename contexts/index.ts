/**
 * Contexts Index
 * 
 * Central export point for all React Contexts in the application.
 * 
 * Authorization (RBAC) structure:
 * - AuthContext: Handles authentication state (user, session, login/logout)
 * - PermissionsContext: Handles permissions/RBAC (isPremium, isAdmin, canAccess)
 * - StockHubContext: Handles stock data caching and sharing between widgets
 */

// Authentication
export { AuthProvider, useAuth } from './AuthContext'

// Permissions / RBAC
export { PermissionsProvider, usePermissions } from './PermissionsContext'

// Stock Data Hub
export { StockHubProvider, useStockHub, useStockHubOptional } from './StockHubContext'
