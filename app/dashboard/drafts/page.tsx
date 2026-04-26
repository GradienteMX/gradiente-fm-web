'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Old route — superseded by the unified `/dashboard?section=drafts` view.
// Kept as a client redirect so any external bookmarks still resolve.
export default function DraftsRedirectPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/dashboard?section=drafts')
  }, [router])
  return null
}
