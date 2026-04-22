# Brain Regeneration Observatory

The Brain Regeneration Observatory is an expansion of the successful [Gregory-MS](https://Gregory-MS.com) platform, designed to accelerate research into brain regeneration and myelin repair. This Hugo-based frontend integrates with GregoryAi to create a comprehensive knowledge hub that tracks therapeutic approaches for reversing damage caused by multiple sclerosis (MS), Alzheimer's Disease, Parkinson's, and other neuro-degenerative diseases.

## Project Mission

Building on Gregory-MS's proven track record of harvesting and de-duplicating scientific literature since 2019, the Brain Regeneration Observatory aims to:

- **Surface high-impact research** within 24 hours of publication
- **Map therapeutic avenues** including remyelination, neuroinflammation control, and stem-cell approaches
- **Monitor clinical trials** across all regenerative medicine approaches
- **Provide patient-centric views** highlighting practical impact and treatment options
- **Support research networks** with customized feeds for investigators and institutions

The platform uses AI models to rank research relevance and delivers tailored alerts to researchers and patients, maintaining our commitment to open science and donor-funded operations. With over 34,000 articles already indexed and partnerships with leading MS organizations, this expansion represents the next phase in democratizing access to cutting-edge neurological research.

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Hugo (for frontend development)

### Initial Setup

1. Clone this repository:
```bash
git clone <repository-url>
cd brain-regeneration
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Start GregoryAi services:
```bash
make start-gregory
```

4. Start Hugo development server:
```bash
make hugo-dev
```

Or start both services at once:
```bash
make dev
```

## Available Commands

Run `make help` to see all available commands:

- `make start-gregory` - Start GregoryAi using Docker Compose
- `make stop-gregory` - Stop GregoryAi services
- `make restart-gregory` - Restart GregoryAi services
- `make logs-gregory` - Show GregoryAi logs
- `make status-gregory` - Show status of GregoryAi services
- `make clean-gregory` - Stop and remove GregoryAi containers and volumes
- `make hugo-dev` - Start Hugo development server
- `make hugo-build` - Build the Hugo site
- `make dev` - Start both GregoryAi and Hugo development server
- `make status` - Show overall project status

## Project Structure

- `/layouts` - Hugo templates and layouts
- `/content` - Site content and pages
- `/assets` - CSS, JS, and other assets
- `/static` - Static files
- `/communication` - Project documentation and briefs
- `docker-compose.yml` - GregoryAi backend service definitions

## GregoryAi Integration

GregoryAi runs as a set of Docker services defined in `docker-compose.yml`:

- PostgreSQL database (port 5432)
- Django API server (port 8000)

## Development Workflow

1. **Start services**: `make start-gregory`
2. **Develop frontend**: `make hugo-dev`
3. **Check logs**: `make logs-gregory`
4. **Check status**: `make status`

## Environment Configuration

Create a `.env` file at the repo root (copy from `.env.example`) and configure:

- Database settings (`POSTGRES_*`)
- Email configuration (`EMAIL_*`)
- Security keys (`SECRET_KEY`, `FERNET_SECRET_KEY`)

## Troubleshooting

- **Docker issues**: Run `make clean-gregory` then `make start-gregory`
- **Port conflicts**: Check if ports 5432 or 8000 are already in use
- **Logs**: Use `make logs-gregory` to see detailed error messages

## Contributing

Please refer to the project guidelines in the `communication/` folder for branding, messaging, and development standards.

