import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useAuth } from '../features/auth'
import { supabase } from '../lib/supabase'
import { Form } from '../components/Form'
import { ErrorState, PageHeading } from '../components/ui'
export function Settings() {
  const { profile, session, refresh } = useAuth()
  const [file, setFile] = useState<File | null>(null)
  const upload = useMutation({
    mutationFn: async () => {
      if (!file || !profile) throw new Error('Choose an image first')
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 2097152)
        throw new Error('Use a JPG, PNG or WebP smaller than 2 MB.')
      const path = `${profile.id}/${crypto.randomUUID()}.${file.type.split('/')[1]}`
      const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: false })
      if (error) throw error
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ avatar_path: path })
        .eq('id', profile.id)
      if (profileError) throw profileError
      refresh()
      setFile(null)
    },
  })
  if (!profile) return null
  const avatar = profile.avatar_path
    ? supabase.storage.from('avatars').getPublicUrl(profile.avatar_path).data.publicUrl
    : null
  return (
    <>
      <PageHeading title="A little about you.">
        Keep your details up to date for your next celebration.
      </PageHeading>
      <div className="settings-grid">
        <section className="panel">
          <h2>Your profile</h2>
          <p className="muted">{session?.user.email}</p>
          <Form
            key={profile.id}
            initial={{ full_name: profile.full_name, phone: profile.phone }}
            fields={[
              { name: 'full_name', label: 'Full name', required: true, max: 150 },
              { name: 'phone', label: 'Phone number', type: 'tel', max: 30 },
            ]}
            submit={async (v) => {
              const { error } = await supabase.from('profiles').update(v).eq('id', profile.id)
              if (error) throw error
              refresh()
            }}
          />
        </section>
        <section className="panel">
          <h2>Your avatar</h2>
          <div className="avatar-preview">
            {avatar ? (
              <img src={avatar} alt="Your profile avatar" />
            ) : (
              <span>{profile.full_name.slice(0, 1) || 'R'}</span>
            )}
          </div>
          <label className="file-field">
            JPG, PNG or WebP · up to 2 MB
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </label>
          <button
            className="button secondary"
            disabled={!file || upload.isPending}
            onClick={() => upload.mutate()}
          >
            {upload.isPending ? 'Uploading…' : 'Upload avatar'}
          </button>
          {upload.error && <ErrorState error={upload.error} />}
        </section>
        <section className="panel">
          <h2>Change your password</h2>
          <Form
            fields={[{ name: 'password', label: 'New password', type: 'password', required: true }]}
            label="Update password"
            submit={async (v) => {
              const { error } = await supabase.auth.updateUser({ password: v.password })
              if (error) throw error
            }}
          />
        </section>
      </div>
    </>
  )
}
