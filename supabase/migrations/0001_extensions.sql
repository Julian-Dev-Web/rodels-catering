create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
revoke all on schema private from public;
