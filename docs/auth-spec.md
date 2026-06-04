# auth-spec.md

## Objective
Implement or modify user synchronization between the frontend Auth.js (NextAuth) session lifecycle and the backend database entity.

## Architectural Requirements
- The backend does not issue JWT tokens or process OAuth handshakes.
- The backend accepts the Auth.js session profile payload via a secure endpoint and creates or updates a custom `User` record to track internal system state.

## Key Snippets & Interfaces

### Payload Synchronization DTO
```typescript
export class SyncDto {
  email: string;
  name?: string;
  image?: string;
  provider: string;
  providerAccountId: string;
}
```

### Context Processing Flow
The frontend hits POST /auth/sync immediately after a successful Auth.js login.

The service performs an upsert execution using the unique compound constraint matching the provider identity:

```typescript
async syncUser(dto: SyncDto) {
  return this.prisma.user.upsert({
    where: {
      provider_providerAccountId: {
        provider: dto.provider,
        providerAccountId: dto.providerAccountId,
      },
    },
    update: {
      name: dto.name,
      image: dto.image,
    },
    create: {
      email: dto.email,
      name: dto.name,
      image: dto.image,
      provider: dto.provider,
      providerAccountId: dto.providerAccountId,
    },
  });
}
```