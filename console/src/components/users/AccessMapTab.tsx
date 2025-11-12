import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ChevronRight, ChevronDown, User, Shield, Database, Key, Search, Loader2, RefreshCw } from "lucide-react"
import { principalsApi } from "@/api/management/principals"
import { catalogRolesApi } from "@/api/management/catalog-roles"
import { privilegesApi } from "@/api/management/privileges"
import { catalogsApi } from "@/api/management/catalogs"
import type { Principal, PrincipalRole, CatalogRole, GrantResource } from "@/types/api"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

// Lazy-loaded principal roles component
function PrincipalRolesView({ 
  principal, 
  isExpanded,
  expandedPrincipalRoles,
  expandedCatalogRoles,
  onTogglePrincipalRole,
  onToggleCatalogRole 
}: {
  principal: Principal
  isExpanded: boolean
  expandedPrincipalRoles: Set<string>
  expandedCatalogRoles: Set<string>
  onTogglePrincipalRole: (key: string) => void
  onToggleCatalogRole: (key: string) => void
}) {
  const { data: principalRoles, isLoading } = useQuery({
    queryKey: ["principals", principal.name, "principal-roles"],
    queryFn: () => principalsApi.listPrincipalRoles(principal.name),
    enabled: isExpanded,
    staleTime: 5 * 60 * 1000,
  })

  if (!isExpanded) return null
  if (isLoading) {
    return (
      <div className="ml-8 p-2 text-sm text-muted-foreground flex items-center gap-2">
        <Loader2 className="h-3 w-3 animate-spin" />
        Loading roles...
      </div>
    )
  }

  if (!principalRoles || principalRoles.length === 0) {
    return (
      <div className="ml-8 p-2 text-sm text-muted-foreground">
        No roles assigned
      </div>
    )
  }

  return (
    <div className="ml-8 space-y-2 border-l-2 border-border/50 pl-4">
      {principalRoles.map((pr) => {
        const prKey = `${principal.name}-${pr.name}`
        const isPrExpanded = expandedPrincipalRoles.has(prKey)

        return (
          <div key={prKey} className="space-y-2">
            <div
              className={`flex items-center gap-2 p-2.5 rounded-lg hover:bg-accent/70 cursor-pointer transition-colors ${
                isPrExpanded ? "bg-accent/70" : ""
              }`}
              onClick={() => onTogglePrincipalRole(prKey)}
            >
              {isPrExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
              <Shield className="h-4 w-4 text-green-600" />
              <span className="font-medium">{pr.name}</span>
              <Badge variant="outline" className="ml-auto text-xs">
                Principal Role
              </Badge>
            </div>

            <CatalogRolesView
              principalName={principal.name}
              principalRole={pr}
              isExpanded={isPrExpanded}
              expandedCatalogRoles={expandedCatalogRoles}
              onToggleCatalogRole={onToggleCatalogRole}
            />
          </div>
        )
      })}
    </div>
  )
}

// Lazy-loaded catalog roles component
function CatalogRolesView({
  principalName,
  principalRole,
  isExpanded,
  expandedCatalogRoles,
  onToggleCatalogRole,
}: {
  principalName: string
  principalRole: PrincipalRole
  isExpanded: boolean
  expandedCatalogRoles: Set<string>
  onToggleCatalogRole: (key: string) => void
}) {
  const catalogsQuery = useQuery({
    queryKey: ["catalogs"],
    queryFn: catalogsApi.list,
    staleTime: 10 * 60 * 1000, // Cache catalogs for 10 minutes
  })

  // Fetch catalog roles for all catalogs where this principal role is assigned
  const catalogRolesQuery = useQuery({
    queryKey: ["principal-role-catalog-roles", principalRole.name],
    queryFn: async () => {
      if (!catalogsQuery.data) return []
      
      const results: Array<{ catalog: string; role: CatalogRole }> = []
      
      // Batch requests per catalog
      await Promise.all(
        catalogsQuery.data.map(async (catalog) => {
          try {
            const catalogRoles = await catalogRolesApi.list(catalog.name)
            
            // Check which catalog roles have this principal role assigned
            const rolesWithThisPrincipalRole = await Promise.all(
              catalogRoles.map(async (catalogRole) => {
                try {
                  const assignedPrincipalRoles = await catalogRolesApi.listPrincipalRoles(
                    catalog.name,
                    catalogRole.name
                  )
                  return assignedPrincipalRoles.some((pr) => pr.name === principalRole.name)
                    ? { catalog: catalog.name, role: catalogRole }
                    : null
                } catch {
                  return null
                }
              })
            )
            
            results.push(...rolesWithThisPrincipalRole.filter((r): r is { catalog: string; role: CatalogRole } => r !== null))
          } catch (error) {
            console.error(`Error fetching catalog roles for ${catalog.name}:`, error)
          }
        })
      )
      
      return results
    },
    enabled: isExpanded && !!catalogsQuery.data,
    staleTime: 5 * 60 * 1000,
  })

  if (!isExpanded) return null
  if (catalogRolesQuery.isLoading) {
    return (
      <div className="ml-8 p-2 text-sm text-muted-foreground flex items-center gap-2">
        <Loader2 className="h-3 w-3 animate-spin" />
        Loading catalog roles...
      </div>
    )
  }

  if (!catalogRolesQuery.data || catalogRolesQuery.data.length === 0) {
    return (
      <div className="ml-8 p-2 text-sm text-muted-foreground">
        No catalog roles assigned
      </div>
    )
  }

  return (
    <div className="ml-8 space-y-2 border-l-2 border-border/50 pl-4">
      {catalogRolesQuery.data.map((cr) => {
        const prKey = `${principalName}-${principalRole.name}`
        const crKey = `${prKey}-${cr.catalog}-${cr.role.name}`
        const isCrExpanded = expandedCatalogRoles.has(crKey)

        return (
          <div key={crKey} className="space-y-2">
            <div
              className={`flex items-center gap-2 p-2.5 rounded-lg hover:bg-accent/50 cursor-pointer transition-colors ${
                isCrExpanded ? "bg-accent/50" : ""
              }`}
              onClick={() => onToggleCatalogRole(crKey)}
            >
              {isCrExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
              <Shield className="h-4 w-4 text-purple-600" />
              <span className="font-medium">{cr.role.name}</span>
              <div className="flex items-center gap-1 ml-2">
                <Database className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{cr.catalog}</span>
              </div>
              <Badge variant="outline" className="ml-auto text-xs">
                Catalog Role
              </Badge>
            </div>

            <PrivilegesView
              catalog={cr.catalog}
              catalogRole={cr.role}
              isExpanded={isCrExpanded}
            />
          </div>
        )
      })}
    </div>
  )
}

// Lazy-loaded privileges component
function PrivilegesView({
  catalog,
  catalogRole,
  isExpanded,
}: {
  catalog: string
  catalogRole: CatalogRole
  isExpanded: boolean
}) {
  const { data: grants, isLoading } = useQuery({
    queryKey: ["grants", catalog, catalogRole.name],
    queryFn: () => privilegesApi.listGrants(catalog, catalogRole.name),
    enabled: isExpanded,
    staleTime: 5 * 60 * 1000,
  })

  if (!isExpanded) return null
  if (isLoading) {
    return (
      <div className="ml-8 p-2 text-sm text-muted-foreground flex items-center gap-2">
        <Loader2 className="h-3 w-3 animate-spin" />
        Loading privileges...
      </div>
    )
  }

  if (!grants || grants.length === 0) {
    return (
      <div className="ml-8 p-2 text-sm text-muted-foreground">
        No privileges granted
      </div>
    )
  }

  const formatEntityPath = (grant: GrantResource): string => {
    switch (grant.type) {
      case "catalog":
        return "(catalog)"
      case "namespace":
        return grant.namespace.length > 0 ? grant.namespace.join(".") : "(root)"
      case "table":
        return grant.namespace.length > 0
          ? `${grant.namespace.join(".")}.${grant.tableName}`
          : grant.tableName
      case "view":
        return grant.namespace.length > 0
          ? `${grant.namespace.join(".")}.${grant.viewName}`
          : grant.viewName
      case "policy":
        return grant.namespace.length > 0
          ? `${grant.namespace.join(".")}.${grant.policyName}`
          : grant.policyName
    }
  }

  return (
    <div className="ml-8 space-y-1.5">
      {grants.map((grant, idx) => (
        <div key={idx} className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/30 border border-border/50">
          <Key className="h-3.5 w-3.5 text-orange-600 flex-shrink-0" />
          <Badge variant="default" className="text-xs font-medium">
            {grant.privilege}
          </Badge>
          <span className="text-xs text-muted-foreground">→</span>
          <Badge variant="secondary" className="text-xs capitalize">
            {grant.type}
          </Badge>
          {formatEntityPath(grant) !== "(catalog)" && (
            <span className="text-xs font-mono text-muted-foreground">
              {formatEntityPath(grant)}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

export function AccessMapTab() {
  const queryClient = useQueryClient()
  const [expandedPrincipals, setExpandedPrincipals] = useState<Set<string>>(new Set())
  const [expandedPrincipalRoles, setExpandedPrincipalRoles] = useState<Set<string>>(new Set())
  const [expandedCatalogRoles, setExpandedCatalogRoles] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState("")

  // Fetch only principals initially - lazy load everything else
  const principalsQuery = useQuery({
    queryKey: ["principals"],
    queryFn: principalsApi.list,
    staleTime: 5 * 60 * 1000,
  })

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["principals"] })
    queryClient.invalidateQueries({ queryKey: ["catalogs"] })
    queryClient.invalidateQueries({ queryKey: ["principal-roles"] })
    queryClient.invalidateQueries({ queryKey: ["principal-role-catalog-roles"] })
    queryClient.invalidateQueries({ queryKey: ["grants"] })
  }

  const filteredPrincipals = principalsQuery.data?.filter((p) =>
    search.trim() ? p.name.toLowerCase().includes(search.toLowerCase()) : true
  ) || []

  const togglePrincipal = (name: string) => {
    const newSet = new Set(expandedPrincipals)
    if (newSet.has(name)) {
      newSet.delete(name)
    } else {
      newSet.add(name)
    }
    setExpandedPrincipals(newSet)
  }

  const togglePrincipalRole = (key: string) => {
    const newSet = new Set(expandedPrincipalRoles)
    if (newSet.has(key)) {
      newSet.delete(key)
    } else {
      newSet.add(key)
    }
    setExpandedPrincipalRoles(newSet)
  }

  const toggleCatalogRole = (key: string) => {
    const newSet = new Set(expandedCatalogRoles)
    if (newSet.has(key)) {
      newSet.delete(key)
    } else {
      newSet.add(key)
    }
    setExpandedCatalogRoles(newSet)
  }

  const expandAll = () => {
    if (!principalsQuery.data) return
    
    // Expand all principals
    setExpandedPrincipals(new Set(principalsQuery.data.map(p => p.name)))
  }

  const collapseAll = () => {
    setExpandedPrincipals(new Set())
    setExpandedPrincipalRoles(new Set())
    setExpandedCatalogRoles(new Set())
  }

  if (principalsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Loading principals...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-center">
        <div className="w-full max-w-4xl space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search principals..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                onClick={handleRefresh}
                disabled={principalsQuery.isFetching}
              >
                <RefreshCw
                  className={`mr-2 h-4 w-4 ${principalsQuery.isFetching ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={expandAll}>
                Expand All
              </Button>
              <Button variant="outline" size="sm" onClick={collapseAll}>
                Collapse All
              </Button>
            </div>
          </div>

          <div className="text-sm text-muted-foreground">
            Click to expand and explore the permission hierarchy. Data loads on-demand.
          </div>
        </div>
      </div>

      {/* Access Tree */}
      <div className="flex justify-center">
        <div className="w-full max-w-4xl">
          <Card className="p-6">
            {filteredPrincipals.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                {search ? "No matching principals found" : "No principals found"}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredPrincipals.map((principal) => {
                  const isExpanded = expandedPrincipals.has(principal.name)

                  return (
                    <div key={principal.name} className="space-y-2">
                      {/* Principal */}
                      <div
                        className={`flex items-center gap-2 p-3 rounded-lg hover:bg-accent cursor-pointer transition-colors border ${
                          isExpanded ? "bg-accent border-border" : "border-transparent"
                        }`}
                        onClick={() => togglePrincipal(principal.name)}
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                        <User className="h-5 w-5 text-blue-600" />
                        <span className="font-semibold text-base">{principal.name}</span>
                      </div>

                      {/* Lazy-loaded principal roles */}
                      <PrincipalRolesView
                        principal={principal}
                        isExpanded={isExpanded}
                        expandedPrincipalRoles={expandedPrincipalRoles}
                        expandedCatalogRoles={expandedCatalogRoles}
                        onTogglePrincipalRole={togglePrincipalRole}
                        onToggleCatalogRole={toggleCatalogRole}
                      />
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

