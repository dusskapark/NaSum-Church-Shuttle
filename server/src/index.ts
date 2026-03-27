import 'dotenv/config';

import express from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();
const app = express();

app.use(express.json());

const scanEventSchema = z.object({
  shuttleRunId: z.string().min(1),
  stopId: z.string().min(1),
  scannedByUserId: z.string().min(1).optional(),
  scannedAt: z.coerce.date().optional()
});

type RouteStopRow = {
  stopId: string;
  sequence: number;
  stop: {
    name: string;
  };
};

type DeclarationRow = {
  userId: string;
  stopId: string;
  user: {
    name: string;
  };
};

function normalizeServiceDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'shuttle-server' });
});

app.post('/api/v1/scan-events', async (req, res) => {
  const parsed = scanEventSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      message: 'Invalid request body',
      issues: parsed.error.flatten()
    });
  }

  const { shuttleRunId, stopId, scannedByUserId, scannedAt } = parsed.data;

  const shuttleRun = await prisma.shuttleRun.findUnique({
    where: { id: shuttleRunId },
    select: { id: true, routeId: true }
  });

  if (!shuttleRun) {
    return res.status(404).json({ message: 'Shuttle run not found' });
  }

  const routeStops = (await prisma.routeStop.findMany({
    where: { routeId: shuttleRun.routeId },
    orderBy: { sequence: 'asc' },
    select: { stopId: true, sequence: true, stop: { select: { name: true } } }
  })) as RouteStopRow[];

  const currentIndex = routeStops.findIndex((routeStop) => routeStop.stopId === stopId);
  if (currentIndex === -1) {
    return res.status(400).json({ message: 'Stop does not belong to shuttle route' });
  }

  const nextTwoStops = routeStops.slice(currentIndex + 1, currentIndex + 3);
  const eventTime = scannedAt ?? new Date();
  const serviceDay = normalizeServiceDay(eventTime);

  const scanEvent = await prisma.scanEvent.create({
    data: {
      shuttleRunId,
      stopId,
      scannedByUserId,
      scannedAt: eventTime
    }
  });

  if (nextTwoStops.length === 0) {
    return res.status(201).json({
      scanEventId: scanEvent.id,
      nextStops: [],
      queuedNotifications: 0
    });
  }

  const candidateStopIds = nextTwoStops.map((stop: RouteStopRow) => stop.stopId);

  const declarations = (await prisma.boardingDeclaration.findMany({
    where: {
      routeId: shuttleRun.routeId,
      stopId: { in: candidateStopIds },
      serviceDay,
      status: 'DECLARED',
      user: { notificationOptIn: true }
    },
    select: {
      userId: true,
      stopId: true,
      user: { select: { name: true } }
    }
  })) as DeclarationRow[];

  const uniqByUserAndStop = new Map<string, { userId: string; stopId: string; userName: string }>();
  declarations.forEach((declaration: DeclarationRow) => {
    const key = `${declaration.userId}:${declaration.stopId}`;
    if (!uniqByUserAndStop.has(key)) {
      uniqByUserAndStop.set(key, {
        userId: declaration.userId,
        stopId: declaration.stopId,
        userName: declaration.user.name
      });
    }
  });

  const queuedNotifications = Array.from(uniqByUserAndStop.values()).map((item) => {
    const targetStopName =
      routeStops.find((routeStop: RouteStopRow) => routeStop.stopId === item.stopId)?.stop.name ?? '다음 정류장';

    return {
      userId: item.userId,
      shuttleRunId,
      targetStopId: item.stopId,
      triggerStopId: stopId,
      title: '셔틀 도착 알림',
      body: `${item.userName}님, ${targetStopName} 탑승 예정 셔틀이 곧 도착합니다.`
    };
  });

  if (queuedNotifications.length > 0) {
    await prisma.notificationDelivery.createMany({
      data: queuedNotifications
    });
  }

  return res.status(201).json({
    scanEventId: scanEvent.id,
    nextStops: nextTwoStops.map((stop: RouteStopRow) => ({
      stopId: stop.stopId,
      sequence: stop.sequence,
      name: stop.stop.name
    })),
    queuedNotifications: queuedNotifications.length
  });
});

const port = Number(process.env.PORT ?? 4000);

async function bootstrap() {
  try {
    await prisma.$connect();
    app.listen(port, () => {
      console.log(`Shuttle server listening on port ${port}`);
    });
  } catch (error) {
    console.error('Failed to start server', error);
    process.exit(1);
  }
}

void bootstrap();
