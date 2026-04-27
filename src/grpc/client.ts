import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import * as path from 'path';

// Find the blueprint we just copied over
const PROTO_PATH = path.join(process.cwd(), 'src/grpc/protos/identity.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true, longs: String, enums: String, defaults: true, oneofs: true,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const protoDescriptor = grpc.loadPackageDefinition(packageDefinition) as any;
const identityProto = protoDescriptor.identity;

// Create the Client that points directly to your running microservice!
export const identityClient = new identityProto.IdentityService(
  'localhost:50051', // The exact port your backend is running on
  grpc.credentials.createInsecure()
);