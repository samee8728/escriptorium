# Generated by Django 4.2.16 on 2024-09-17 14:02

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('reporting', '0008_taskgroup_taskreport_group'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='taskgroup',
            options={'ordering': ['-created_at']},
        ),
    ]
