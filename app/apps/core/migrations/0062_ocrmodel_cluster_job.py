# Generated by Django 2.2.24 on 2021-11-23 17:57

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0061_clusterjob_ocr_model'),
    ]

    operations = [
        migrations.AddField(
            model_name='ocrmodel',
            name='cluster_job',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, to='core.ClusterJob'),
        ),
    ]
