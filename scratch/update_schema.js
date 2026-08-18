const fs = require('fs');
let schema = fs.readFileSync('prisma/schema.prisma', 'utf8');
if (!schema.includes('model JobApplication')) {
  schema += `
model JobApplication {
  id              String   @id @default(cuid())
  name            String
  region          String
  phone           String
  carType         String
  hasAc           Boolean  @default(false)
  hasCommitment   Boolean  @default(false)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  status          String   @default("pending")
}
`;
  fs.writeFileSync('prisma/schema.prisma', schema);
  console.log("Appended JobApplication to schema");
} else {
  console.log("JobApplication already exists in schema");
}
