# Generated by Django 2.2.24 on 2021-11-24 20:48

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0065_document_submitting_job'),
    ]

    operations = [
        migrations.AlterField(
            model_name='clusterjob',
            name='last_known_state',
            field=models.CharField(default='Unsubmitted', max_length=20),
        ),
    ]
