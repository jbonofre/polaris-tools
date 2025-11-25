/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/hooks/useAuth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Logo } from "@/components/layout/Logo"
import { AUTH_TYPES } from "@/lib/constants"
import type { AuthType } from "@/api/auth"

export function Login() {
  // Initialize auth type from environment variable or default to 'internal'
  const [authType, setAuthType] = useState<AuthType>(
    (import.meta.env.VITE_AUTH_TYPE as AuthType) || "internal"
  )
  const [clientId, setClientId] = useState("")
  const [clientSecret, setClientSecret] = useState("")
  // Initialize Polaris realm with value from .env file if present
  const [polarisRealm, setPolarisRealm] = useState(import.meta.env.VITE_POLARIS_REALM || "")
  // Initialize Keycloak realm (empty by default)
  const [keycloakRealm, setKeycloakRealm] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const realm = authType === "internal" ? polarisRealm : keycloakRealm
      await login(
        clientId,
        clientSecret,
        authType,
        realm || undefined,
        authType === "keycloak" ? polarisRealm || undefined : undefined
      )
      navigate("/")
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to authenticate. Please check your credentials."
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      {/* Logo at top */}
      {/* <div className="absolute top-8 left-8">
        <Logo clickable={false} />
      </div> */}

      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center">
            <Logo clickable={false} />
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="authType">Authentication Type</Label>
              <Select
                value={authType}
                onValueChange={(value) => setAuthType(value as AuthType)}
              >
                <SelectTrigger id="authType">
                  <SelectValue placeholder="Select authentication type" />
                </SelectTrigger>
                <SelectContent>
                  {AUTH_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="clientId">Client ID</Label>
              <Input
                id="clientId"
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                required
                placeholder="Enter your client ID"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clientSecret">Client Secret</Label>
              <Input
                id="clientSecret"
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                required
                placeholder="Enter your client secret"
              />
            </div>
            {authType === "internal" ? (
              <div className="space-y-2">
                <Label htmlFor="polarisRealm">Polaris Realm</Label>
                <Input
                  id="polarisRealm"
                  type="text"
                  value={polarisRealm}
                  onChange={(e) => setPolarisRealm(e.target.value)}
                  placeholder="Enter your Polaris realm"
                />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="keycloakRealm">Keycloak Realm</Label>
                  <Input
                    id="keycloakRealm"
                    type="text"
                    value={keycloakRealm}
                    onChange={(e) => setKeycloakRealm(e.target.value)}
                    required
                    placeholder="Enter your Keycloak realm (e.g., iceberg)"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="polarisRealm">Polaris Realm</Label>
                  <Input
                    id="polarisRealm"
                    type="text"
                    value={polarisRealm}
                    onChange={(e) => setPolarisRealm(e.target.value)}
                    placeholder="Enter your Polaris realm (optional)"
                  />
                </div>
              </>
            )}
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

