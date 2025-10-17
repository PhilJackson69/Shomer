# Nginx Configuration for Shomer

This directory contains the nginx reverse proxy configuration for production deployments.

## Structure

```
infra/nginx/
├── nginx.conf         # Main nginx configuration
├── certs/            # TLS/SSL certificates (not in git)
│   ├── fullchain.pem
│   └── privkey.pem
├── www/              # Static files and Let's Encrypt challenge
└── README.md         # This file
```

## TLS/SSL Certificates

### Option 1: Let's Encrypt (Recommended)

Use Certbot to obtain free certificates:

```bash
# Install certbot
sudo apt-get install certbot

# Obtain certificate (standalone mode)
sudo certbot certonly --standalone -d shomer.app -d www.shomer.app

# Copy certificates
sudo cp /etc/letsencrypt/live/shomer.app/fullchain.pem infra/nginx/certs/
sudo cp /etc/letsencrypt/live/shomer.app/privkey.pem infra/nginx/certs/
sudo chmod 644 infra/nginx/certs/*.pem
```

### Option 2: Self-Signed (Development Only)

For testing purposes only:

```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout infra/nginx/certs/privkey.pem \
  -out infra/nginx/certs/fullchain.pem \
  -subj "/CN=localhost"
```

**⚠ Never use self-signed certificates in production!**

## Configuration Features

### Security Headers

- **HSTS**: Forces HTTPS for 1 year
- **X-Frame-Options**: Prevents clickjacking
- **X-Content-Type-Options**: Prevents MIME sniffing
- **CSP**: Content Security Policy
- **X-XSS-Protection**: XSS filter

### Rate Limiting

- **API**: 60 requests/minute per IP
- **Uploads**: 10 requests/minute per IP
- **Exports**: 5 requests/minute per IP

### Performance

- **Gzip compression**: Enabled for text/JSON/JS
- **HTTP/2**: Enabled
- **Keepalive**: Connection pooling
- **Client max body size**: 100MB (for evidence uploads)

## Testing Configuration

Before deploying, test the configuration:

```bash
# Test syntax
docker run --rm -v $(pwd)/infra/nginx/nginx.conf:/etc/nginx/nginx.conf:ro \
  nginx:alpine nginx -t

# Test with docker-compose
docker-compose -f docker-compose.prod.yml config
```

## Monitoring

### Access Logs

Logs are stored in the `nginx-logs` volume:

```bash
# View access logs
docker exec shomer-proxy tail -f /var/log/nginx/access.log

# View error logs
docker exec shomer-proxy tail -f /var/log/nginx/error.log
```

### Metrics

Nginx exports metrics in the access log that can be parsed by log aggregators:

- Request time (`$request_time`)
- Upstream connect time (`$upstream_connect_time`)
- Upstream header time (`$upstream_header_time`)
- Upstream response time (`$upstream_response_time`)

## Troubleshooting

### Certificate Issues

If you see SSL errors:

1. Check certificate files exist:
   ```bash
   ls -la infra/nginx/certs/
   ```

2. Verify certificate validity:
   ```bash
   openssl x509 -in infra/nginx/certs/fullchain.pem -text -noout
   ```

3. Check certificate matches key:
   ```bash
   openssl x509 -noout -modulus -in infra/nginx/certs/fullchain.pem | openssl md5
   openssl rsa -noout -modulus -in infra/nginx/certs/privkey.pem | openssl md5
   ```

### Rate Limiting

If legitimate users are being rate limited:

1. Increase limits in `nginx.conf`:
   ```nginx
   limit_req_zone $binary_remote_addr zone=api_limit:10m rate=120r/m;
   ```

2. Reload nginx:
   ```bash
   docker exec shomer-proxy nginx -s reload
   ```

### Performance Issues

1. Check upstream health:
   ```bash
   docker exec shomer-proxy wget -qO- http://api:8000/health
   ```

2. Monitor resource usage:
   ```bash
   docker stats shomer-proxy
   ```

## Production Checklist

Before going live:

- [ ] Valid TLS certificates installed
- [ ] Domain name configured (A/AAAA records)
- [ ] Firewall configured (allow 80, 443)
- [ ] Rate limits appropriate for traffic
- [ ] Logs being collected/monitored
- [ ] Health checks passing
- [ ] HTTPS redirect working
- [ ] Security headers verified (use securityheaders.com)
- [ ] Load testing completed

## Updates

To update the configuration:

1. Edit `nginx.conf`
2. Test configuration:
   ```bash
   docker exec shomer-proxy nginx -t
   ```
3. Reload without downtime:
   ```bash
   docker exec shomer-proxy nginx -s reload
   ```

## Support

For issues or questions, see the main documentation or contact the team.

