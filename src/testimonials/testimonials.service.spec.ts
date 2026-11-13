import { EntityManager } from '@mikro-orm/core';
import { getRepositoryToken } from '@mikro-orm/nestjs';
import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Testimonial } from '../model/testimonial.entity';
import { TestimonialsService } from './testimonials.service';

describe('TestimonialsService', () => {
  let service: TestimonialsService;
  let count: jest.Mock;
  let getConnection: jest.Mock;

  beforeEach(async () => {
    count = jest.fn().mockResolvedValue(5);
    getConnection = jest.fn();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TestimonialsService,
        {
          provide: EntityManager,
          useValue: { getConnection }
        },
        {
          provide: getRepositoryToken(Testimonial),
          useValue: { count }
        }
      ]
    }).compile();

    service = module.get<TestimonialsService>(TestimonialsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('count', () => {
    it.each([
      'select count(*) as count from testimonial',
      'select count(1) as count from testimonial',
      ' SELECT COUNT ( * ) AS count FROM testimonial; ',
      'select\ncount( 1 )\tas count from testimonial ;\n'
    ])('counts all testimonials for the supported request %j', async (query) => {
      await expect(service.count(query)).resolves.toBe(5);
      expect(count).toHaveBeenCalledWith({});
      expect(count).toHaveBeenCalledTimes(1);
      expect(getConnection).not.toHaveBeenCalled();
    });

    it('returns zero when there are no testimonials', async () => {
      count.mockResolvedValue(0);

      await expect(
        service.count('select count(*) as count from testimonial')
      ).resolves.toBe(0);
    });

    it.each(
      [
        'select count(*) as count from testimonial; select pg_sleep(5)',
        'select count(*) as count from testimonial union select 1',
        'select count(*) as count from testimonial where 1 = 1',
        'select count(*) as count from testimonial -- comment',
        'select count(*) as count from testimonial/* comment */',
        'select count(table_name) as count from information_schema.tables',
        'select count(pg_sleep(5)) as count from testimonial',
        'select count(*) as count from testimonial\n; select pg_sleep(5)',
        'select%20count(*)%20as%20count%20from%20testimonial',
        'select count(*) as count from testimonial\u0000',
        '',
        undefined,
        null,
        ['select count(*) as count from testimonial'],
        { query: 'select count(*) as count from testimonial' }
      ].map((query) => ({ query }))
    )(
      'rejects unsupported input $query before database access',
      async ({ query }) => {
        await expect(service.count(query as string)).rejects.toBeInstanceOf(
          BadRequestException
        );
        expect(count).not.toHaveBeenCalled();
        expect(getConnection).not.toHaveBeenCalled();
      }
    );

    it('propagates database failures instead of returning an error as a count', async () => {
      const error = new Error('Database unavailable');
      count.mockRejectedValue(error);

      await expect(
        service.count('select count(*) as count from testimonial')
      ).rejects.toBe(error);
      expect(getConnection).not.toHaveBeenCalled();
    });
  });
});
