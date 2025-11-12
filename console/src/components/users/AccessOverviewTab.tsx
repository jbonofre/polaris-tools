import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useSearchParams } from "react-router-dom"
import { User, Shield, Database, Key, TrendingUp, AlertCircle, RefreshCw } from "lucide-react"
import { principalsApi } from "@/api/management/principals"
import { principalRolesApi } from "@/api/management/principal-roles"
import { catalogsApi } from "@/api/management/catalogs"
import { catalogRolesApi } from "@/api/management/catalog-roles"
import { privilegesApi } from "@/api/management/privileges"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useMemo, useState, useEffect } from "react"

interface StatsData {
  totalPrincipals: number
  totalPrincipalRoles: number
  totalCatalogRoles: number
  totalPrivileges: number
  principalsWithNoRoles: number
  principalRolesWithNoCatalogRoles: number
  catalogRolesWithNoPrivileges: number
}

export function AccessOverviewTab() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [stats, setStats] = useState<StatsData>({
    totalPrincipals: 0,
    totalPrincipalRoles: 0,
    totalCatalogRoles: 0,
    totalPrivileges: 0,
    principalsWithNoRoles: 0,
    principalRolesWithNoCatalogRoles: 0,
    catalogRolesWithNoPrivileges: 0,
  })

  const navigateToTab = (tab: string) => {
    setSearchParams({ tab })
  }

  const principalsQuery = useQuery({
    queryKey: ["principals"],
    queryFn: principalsApi.list,
  })

  const principalRolesQuery = useQuery({
    queryKey: ["principal-roles"],
    queryFn: principalRolesApi.list,
  })

  const catalogsQuery = useQuery({
    queryKey: ["catalogs"],
    queryFn: catalogsApi.list,
  })

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["principals"] })
    queryClient.invalidateQueries({ queryKey: ["principal-roles"] })
    queryClient.invalidateQueries({ queryKey: ["catalogs"] })
  }

  // Calculate statistics with optimized batching
  useEffect(() => {
    const calculateStats = async () => {
      if (
        !principalsQuery.data ||
        !principalRolesQuery.data ||
        !catalogsQuery.data
      ) {
        return
      }

      try {
        // Batch all catalog role requests
        const catalogRolesResults = await Promise.all(
          catalogsQuery.data.map(async (catalog) => {
            try {
              const roles = await catalogRolesApi.list(catalog.name)
              return { catalog: catalog.name, roles }
            } catch (error) {
              console.error(`Error fetching catalog roles for ${catalog.name}:`, error)
              return { catalog: catalog.name, roles: [] }
            }
          })
        )

        const totalCatalogRoles = catalogRolesResults.reduce(
          (sum, result) => sum + result.roles.length,
          0
        )

                // Count total privileges across all catalog roles (batched for performance)
                const grantsPromises = catalogRolesResults.flatMap((result) =>
                  result.roles.map(async (role) => {
                    try {
                      const grants = await privilegesApi.listGrants(
                        result.catalog,
                        role.name
                      )
                      return { grants, catalog: result.catalog, role: role.name }
                    } catch (error) {
                      console.error(`Error fetching grants for ${result.catalog}/${role.name}:`, error)
                      return { grants: [], catalog: result.catalog, role: role.name }
                    }
                  })
                )

                const grantsResults = await Promise.all(grantsPromises)
                const totalPrivileges = grantsResults.reduce((sum, result) => sum + result.grants.length, 0)
                const catalogRolesWithNoPrivileges = grantsResults.filter(result => result.grants.length === 0).length

        // Quick check for principals with no roles (sample first 10 only for performance)
        const sampleSize = Math.min(10, principalsQuery.data.length)
        const principalSample = principalsQuery.data.slice(0, sampleSize)
        
        const principalRoleChecks = await Promise.all(
          principalSample.map(async (principal) => {
            try {
              const roles = await principalsApi.listPrincipalRoles(principal.name)
              return roles.length === 0 ? 1 : 0
            } catch (error) {
              return 0
            }
          })
        )
        
        const principalsWithNoRoles = principalRoleChecks.reduce((sum, val) => sum + val, 0)

        // Skip expensive principal role checks for now
        const principalRolesWithNoCatalogRoles = 0

        setStats({
          totalPrincipals: principalsQuery.data.length,
          totalPrincipalRoles: principalRolesQuery.data.length,
          totalCatalogRoles,
          totalPrivileges,
          principalsWithNoRoles,
          principalRolesWithNoCatalogRoles,
          catalogRolesWithNoPrivileges,
        })
      } catch (error) {
        console.error("Error calculating stats:", error)
      }
    }

    calculateStats()
  }, [principalsQuery.data, principalRolesQuery.data, catalogsQuery.data])

  const isLoading =
    principalsQuery.isLoading ||
    principalRolesQuery.isLoading ||
    catalogsQuery.isLoading

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Loading overview...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-center">
        <div className="w-full max-w-4xl">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">Access Control Overview</h2>
              <p className="text-sm text-muted-foreground">
                Summary of your access control configuration
              </p>
            </div>
            <Button
              variant="secondary"
              onClick={handleRefresh}
              disabled={isLoading}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="flex justify-center">
        <div className="w-full max-w-4xl">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Principals */}
            <Card 
              className="p-6 cursor-pointer transition-all hover:shadow-lg hover:scale-105 hover:border-blue-500"
              onClick={() => navigateToTab('principals')}
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Principals</p>
                  <p className="text-3xl font-bold">{stats.totalPrincipals}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                  <User className="h-6 w-6 text-blue-600" />
                </div>
              </div>
              {stats.principalsWithNoRoles > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <div className="flex items-center gap-2 text-xs text-amber-600">
                    <AlertCircle className="h-3 w-3" />
                    <span>{stats.principalsWithNoRoles} without roles</span>
                  </div>
                </div>
              )}
            </Card>

            {/* Principal Roles */}
            <Card 
              className="p-6 cursor-pointer transition-all hover:shadow-lg hover:scale-105 hover:border-green-500"
              onClick={() => navigateToTab('principal-roles')}
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Principal Roles</p>
                  <p className="text-3xl font-bold">{stats.totalPrincipalRoles}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                  <Shield className="h-6 w-6 text-green-600" />
                </div>
              </div>
              {stats.principalRolesWithNoCatalogRoles > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <div className="flex items-center gap-2 text-xs text-amber-600">
                    <AlertCircle className="h-3 w-3" />
                    <span>{stats.principalRolesWithNoCatalogRoles} not assigned</span>
                  </div>
                </div>
              )}
            </Card>

            {/* Catalog Roles */}
            <Card 
              className="p-6 cursor-pointer transition-all hover:shadow-lg hover:scale-105 hover:border-purple-500"
              onClick={() => navigateToTab('catalog-roles')}
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Catalog Roles</p>
                  <p className="text-3xl font-bold">{stats.totalCatalogRoles}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
                  <Database className="h-6 w-6 text-purple-600" />
                </div>
              </div>
              {stats.catalogRolesWithNoPrivileges > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <div className="flex items-center gap-2 text-xs text-amber-600">
                    <AlertCircle className="h-3 w-3" />
                    <span>{stats.catalogRolesWithNoPrivileges} without privileges</span>
                  </div>
                </div>
              )}
            </Card>

            {/* Privileges */}
            <Card 
              className="p-6 cursor-pointer transition-all hover:shadow-lg hover:scale-105 hover:border-orange-500"
              onClick={() => navigateToTab('privileges')}
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Privileges</p>
                  <p className="text-3xl font-bold">{stats.totalPrivileges}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
                  <Key className="h-6 w-6 text-orange-600" />
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Permission Flow Diagram */}
      <div className="flex justify-center">
        <div className="w-full max-w-4xl">
          <Card className="p-6">
            <h3 className="text-sm font-semibold mb-4">Permission Flow</h3>
            <div className="flex items-center justify-center gap-8 py-8">
              <div 
                className="flex flex-col items-center gap-2 cursor-pointer transition-all hover:scale-110"
                onClick={() => navigateToTab('principals')}
              >
                <div className="h-16 w-16 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center hover:shadow-lg transition-shadow">
                  <User className="h-8 w-8 text-blue-600" />
                </div>
                <span className="text-sm font-medium">Principal</span>
                <Badge variant="secondary">{stats.totalPrincipals}</Badge>
              </div>

              <div className="flex flex-col items-center">
                <div className="h-0.5 w-16 bg-border" />
                <span className="text-xs text-muted-foreground mt-1">assigned to</span>
              </div>

              <div 
                className="flex flex-col items-center gap-2 cursor-pointer transition-all hover:scale-110"
                onClick={() => navigateToTab('principal-roles')}
              >
                <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center hover:shadow-lg transition-shadow">
                  <Shield className="h-8 w-8 text-green-600" />
                </div>
                <span className="text-sm font-medium">Principal Role</span>
                <Badge variant="secondary">{stats.totalPrincipalRoles}</Badge>
              </div>

              <div className="flex flex-col items-center">
                <div className="h-0.5 w-16 bg-border" />
                <span className="text-xs text-muted-foreground mt-1">granted</span>
              </div>

              <div 
                className="flex flex-col items-center gap-2 cursor-pointer transition-all hover:scale-110"
                onClick={() => navigateToTab('catalog-roles')}
              >
                <div className="h-16 w-16 rounded-full bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center hover:shadow-lg transition-shadow">
                  <Shield className="h-8 w-8 text-purple-600" />
                </div>
                <span className="text-sm font-medium">Catalog Role</span>
                <Badge variant="secondary">{stats.totalCatalogRoles}</Badge>
              </div>

              <div className="flex flex-col items-center">
                <div className="h-0.5 w-16 bg-border" />
                <span className="text-xs text-muted-foreground mt-1">has</span>
              </div>

              <div 
                className="flex flex-col items-center gap-2 cursor-pointer transition-all hover:scale-110"
                onClick={() => navigateToTab('privileges')}
              >
                <div className="h-16 w-16 rounded-full bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center hover:shadow-lg transition-shadow">
                  <Key className="h-8 w-8 text-orange-600" />
                </div>
                <span className="text-sm font-medium">Privileges</span>
                <Badge variant="secondary">On Resources</Badge>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Warnings/Recommendations */}
      {stats.principalsWithNoRoles > 0 && (
        <div className="flex justify-center">
          <div className="w-full max-w-4xl">
            <Card className="p-6 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                    Configuration Recommendations
                  </h3>
                  <ul className="text-sm text-amber-800 dark:text-amber-200 space-y-1 list-disc list-inside">
                    <li>
                      Found {stats.principalsWithNoRoles} principal{stats.principalsWithNoRoles !== 1 ? "s" : ""} (in sample) with no
                      roles assigned. Consider assigning roles or removing unused principals.
                    </li>
                  </ul>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}

