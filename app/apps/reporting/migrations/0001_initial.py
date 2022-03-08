# Generated by Django 2.1.4 on 2020-10-09 10:15

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='TaskReport',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('workflow_state', models.PositiveSmallIntegerField(choices=[(0, 'Queued'), (1, 'Running'), (2, 'Crashed'), (3, 'Finished')], default=0)),
                ('label', models.CharField(max_length=256)),
                ('messages', models.TextField(blank=True)),
                ('queued_at', models.DateTimeField(auto_now_add=True)),
                ('started_at', models.DateTimeField(null=True)),
                ('done_at', models.DateTimeField(null=True)),
                ('task_id', models.CharField(blank=True, max_length=64, null=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
            ],
        ),
    ]
